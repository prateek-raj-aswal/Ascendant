-- =============================================================================
-- Migration: 001_phase1_schema.sql
-- Story:     S-006 — Database schema and migrations for Phase 1 entities
--
-- Creates the four core Phase 1 tables:
--   user_profiles    — one row per authenticated user, extends auth.users
--   skill_categories — static lookup table (Body, Mind, Craft, Spirit)
--   user_skills      — skills tracked per user, scoped to a category
--   session_logs     — individual training session records
--
-- Row-level security (RLS) is enabled on all tables so that each user can
-- only read and write their own data. The 'authenticated' role represents any
-- verified Supabase session; auth.uid() resolves the caller's UUID from the
-- current JWT claim.
--
-- DOWN block at the bottom drops all objects in reverse dependency order.
-- =============================================================================

-- UP

-- ---------------------------------------------------------------------------
-- user_profiles
-- One profile per auth.users row. Stores game state, streak data, and
-- subscription/quota metadata. Deleting the auth user cascades here.
-- ---------------------------------------------------------------------------
CREATE TABLE public.user_profiles (
  id                   uuid          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name         varchar(100)  NOT NULL,
  avatar_seed          varchar(64)   NOT NULL,
  -- Character class name; starts at shadow_novice and advances with XP
  class                varchar(30)   NOT NULL DEFAULT 'shadow_novice',
  total_xp             integer       NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  burnout_active       boolean       NOT NULL DEFAULT false,
  -- Null when burnout is not active
  burnout_started_at   timestamptz,
  current_streak       integer       NOT NULL DEFAULT 0,
  longest_streak       integer       NOT NULL DEFAULT 0,
  -- Null until the user logs their first session
  last_session_date    date,
  subscription_tier    varchar(10)   NOT NULL DEFAULT 'free',
  ai_calls_this_month  integer       NOT NULL DEFAULT 0,
  -- Resets monthly; stored so the API can check without a separate call
  ai_quota_reset_at    timestamptz   NOT NULL DEFAULT now(),
  created_at           timestamptz   NOT NULL DEFAULT now(),
  updated_at           timestamptz   NOT NULL DEFAULT now()
);

-- Each user may only view and update their own profile row.
-- INSERT is handled via a SECURITY DEFINER function (not in this migration).
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view own profile"
  ON public.user_profiles
  FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (id = auth.uid());

-- Allow the authenticated role to use the table (RLS controls row visibility).
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;

-- ---------------------------------------------------------------------------
-- skill_categories
-- Static lookup table: Body, Mind, Craft, Spirit.
-- Only admins/migrations insert here; authenticated users SELECT only.
-- ---------------------------------------------------------------------------
CREATE TABLE public.skill_categories (
  id            uuid       PRIMARY KEY DEFAULT gen_random_uuid(),
  name          varchar(50) NOT NULL UNIQUE,
  display_order smallint    NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Authenticated users may read categories; no app-layer writes permitted.
ALTER TABLE public.skill_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can view categories"
  ON public.skill_categories
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.skill_categories TO authenticated;

-- Seed the four canonical skill categories in display order.
INSERT INTO public.skill_categories (name, display_order) VALUES
  ('Body',   1),
  ('Mind',   2),
  ('Craft',  3),
  ('Spirit', 4);

-- ---------------------------------------------------------------------------
-- user_skills
-- Each row is a skill belonging to one user in one category.
-- ON DELETE CASCADE from user_profiles ensures no orphaned rows.
-- ON DELETE RESTRICT from skill_categories prevents accidental category removal.
-- ---------------------------------------------------------------------------
CREATE TABLE public.user_skills (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid         NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  category_id     uuid         NOT NULL REFERENCES public.skill_categories(id) ON DELETE RESTRICT,
  name            varchar(100) NOT NULL,
  description     text,
  current_xp      integer      NOT NULL DEFAULT 0 CHECK (current_xp >= 0),
  -- peak_xp tracks the historical maximum so decay is visible in the UI
  peak_xp         integer      NOT NULL DEFAULT 0,
  -- Null until the user logs a session for this skill
  last_session_at timestamptz,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now()
);

-- Index for fetching all skills belonging to a specific user.
CREATE INDEX ON public.user_skills (user_id);

-- Index for filtering by user within a category (skill selector UI).
CREATE INDEX ON public.user_skills (user_id, category_id);

-- Index used by the decay job: WHERE last_session_at < now() - INTERVAL '7 days'
CREATE INDEX ON public.user_skills (last_session_at);

-- Each user manages only their own skills.
ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can manage own skills"
  ON public.user_skills
  FOR ALL
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_skills TO authenticated;

-- ---------------------------------------------------------------------------
-- session_logs
-- Immutable log of every training session. Cascade-deleted when the parent
-- user_skill is removed so storage stays clean.
-- ---------------------------------------------------------------------------
CREATE TABLE public.session_logs (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid          NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  skill_id              uuid          NOT NULL REFERENCES public.user_skills(id)   ON DELETE CASCADE,
  duration_minutes      integer       NOT NULL CHECK (duration_minutes > 0),
  -- Multiplier applied to base XP; range 0.5 (easy) … 2.0 (brutal)
  difficulty_multiplier numeric(3,2)  NOT NULL CHECK (difficulty_multiplier BETWEEN 0.5 AND 2.0),
  xp_earned             integer       NOT NULL,
  is_rest               boolean       NOT NULL DEFAULT false,
  notes                 text,
  logged_at             timestamptz   NOT NULL DEFAULT now(),
  session_date          date          NOT NULL
);

-- Index for the user's session history feed, ordered by time.
CREATE INDEX ON public.session_logs (user_id, logged_at);

-- Index for per-skill history queries.
CREATE INDEX ON public.session_logs (skill_id, logged_at);

-- Index for streak calculation: daily aggregation per user.
CREATE INDEX ON public.session_logs (user_id, session_date);

-- Users may view and insert only their own logs.
-- Deletion is handled by cascade from user_skills; no direct DELETE policy.
ALTER TABLE public.session_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view own session logs"
  ON public.session_logs
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users can insert own session logs"
  ON public.session_logs
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT ON public.session_logs TO authenticated;

-- =============================================================================
-- DOWN
--
-- Drop all Phase 1 tables in reverse FK dependency order.
-- CASCADE handles any views or other references created after this migration.
-- =============================================================================

-- DOWN

DROP TABLE IF EXISTS public.session_logs     CASCADE;
DROP TABLE IF EXISTS public.user_skills      CASCADE;
DROP TABLE IF EXISTS public.skill_categories CASCADE;
DROP TABLE IF EXISTS public.user_profiles    CASCADE;
