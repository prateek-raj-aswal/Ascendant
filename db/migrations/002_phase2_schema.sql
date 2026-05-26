-- =============================================================================
-- Migration: 002_phase2_schema.sql
-- Story:     S-014 — Database schema additions for Phase 2/3 entities
--
-- Creates two new tables:
--   quests                  — user-assigned goals tied optionally to a skill
--   class_promotion_events  — immutable log of class-tier promotions
--
-- Row-level security (RLS) is enabled on both tables.
-- quests: full CRUD by owner.
-- class_promotion_events: SELECT + INSERT only (immutable — no UPDATE/DELETE).
-- =============================================================================

-- UP

-- ---------------------------------------------------------------------------
-- quests
-- User-assigned goals. May optionally be scoped to a single user_skill.
-- Deleting the owning user cascades. Deleting the skill sets skill_id to NULL.
-- ---------------------------------------------------------------------------
CREATE TABLE public.quests (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  skill_id    uuid        REFERENCES public.user_skills(id) ON DELETE SET NULL,
  title       text        NOT NULL,
  description text,
  difficulty  integer     NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  xp_reward   integer     NOT NULL DEFAULT 0,
  quest_type  text        NOT NULL CHECK (quest_type IN ('daily', 'weekly', 'one_time')),
  status      text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
  deadline    timestamptz,
  completed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON public.quests (user_id);
CREATE INDEX ON public.quests (status);
CREATE INDEX ON public.quests (skill_id);

ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can select own quests"
  ON public.quests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users can insert own quests"
  ON public.quests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users can update own quests"
  ON public.quests FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "users can delete own quests"
  ON public.quests FOR DELETE
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quests TO authenticated;

-- ---------------------------------------------------------------------------
-- class_promotion_events
-- Immutable log of class-tier promotions. Once written, rows must not change.
-- No UPDATE or DELETE policy is created — only SELECT and INSERT are allowed
-- for the 'authenticated' role.
-- ---------------------------------------------------------------------------
CREATE TABLE public.class_promotion_events (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid        NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  from_class            text        NOT NULL,
  to_class              text        NOT NULL,
  total_xp_at_promotion integer     NOT NULL,
  viewed                boolean     NOT NULL DEFAULT false,
  promoted_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON public.class_promotion_events (user_id);
CREATE INDEX ON public.class_promotion_events (promoted_at);

ALTER TABLE public.class_promotion_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can select own promotion events"
  ON public.class_promotion_events FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users can insert own promotion events"
  ON public.class_promotion_events FOR INSERT
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT ON public.class_promotion_events TO authenticated;

-- =============================================================================
-- DOWN
-- =============================================================================

-- DOWN

DROP TABLE IF EXISTS public.class_promotion_events CASCADE;
DROP TABLE IF EXISTS public.quests CASCADE;
