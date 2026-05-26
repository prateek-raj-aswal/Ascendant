# Database Schema — Phase 1 Entities

Migration: `db/migrations/001_phase1_schema.sql`  
Story: S-006  
Applied to: `public` schema in Supabase (Postgres)

Row-level security (RLS) is enabled on all tables. All policies use `auth.uid()` to scope each row to its owner. See [ADR-005](../adr/ADR-005-rls-at-database-layer.md).

---

## user_profiles

One row per authenticated user. Extends `auth.users` — the `id` is a FK to `auth.users(id) ON DELETE CASCADE`.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | — | PK, FK auth.users(id) ON DELETE CASCADE |
| display_name | varchar(100) | NOT NULL | — | |
| avatar_seed | varchar(64) | NOT NULL | — | |
| class | varchar(30) | NOT NULL | `'shadow_novice'` | Advances with XP thresholds |
| total_xp | integer | NOT NULL | 0 | CHECK >= 0 |
| burnout_active | boolean | NOT NULL | false | |
| burnout_started_at | timestamptz | NULL | — | NULL when not in burnout |
| current_streak | integer | NOT NULL | 0 | |
| longest_streak | integer | NOT NULL | 0 | |
| last_session_date | date | NULL | — | NULL until first session |
| subscription_tier | varchar(10) | NOT NULL | `'free'` | |
| ai_calls_this_month | integer | NOT NULL | 0 | |
| ai_quota_reset_at | timestamptz | NOT NULL | now() | |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |

**RLS policies**

| Policy | Operation | Rule |
|---|---|---|
| users can view own profile | SELECT | `id = auth.uid()` |
| users can update own profile | UPDATE | `id = auth.uid()` |

INSERT is handled via a SECURITY DEFINER function (not in this migration). Direct INSERT by the `authenticated` role is not covered by a policy.

**Grants**: `SELECT, INSERT, UPDATE` to `authenticated`.

---

## skill_categories

Static lookup table. Fixed to four rows by migration seed. Authenticated users may read; no app-layer writes are permitted. See [ADR-007](../adr/ADR-007-skill-categories-immutable.md).

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() |
| name | varchar(50) | NOT NULL | — |
| display_order | smallint | NOT NULL | — |
| created_at | timestamptz | NOT NULL | now() |

UNIQUE constraint on `name`.

**Seed data**

| name | display_order |
|---|---|
| Body | 1 |
| Mind | 2 |
| Craft | 3 |
| Spirit | 4 |

**RLS policies**

| Policy | Operation | Rule |
|---|---|---|
| authenticated users can view categories | SELECT | `true` (all authenticated users) |

**Grants**: `SELECT` to `authenticated`.

---

## user_skills

Each row is a skill belonging to one user, scoped to one category.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| user_id | uuid | NOT NULL | — | FK user_profiles(id) ON DELETE CASCADE |
| category_id | uuid | NOT NULL | — | FK skill_categories(id) ON DELETE RESTRICT |
| name | varchar(100) | NOT NULL | — | |
| description | text | NULL | — | |
| current_xp | integer | NOT NULL | 0 | CHECK >= 0 |
| peak_xp | integer | NOT NULL | 0 | Historical max; used to show decay |
| last_session_at | timestamptz | NULL | — | NULL until first session for this skill |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |

**Indexes**

| Columns | Purpose |
|---|---|
| (user_id) | Fetch all skills for a user |
| (user_id, category_id) | Filter skills by category in the skill selector UI |
| (last_session_at) | Decay job query: `WHERE last_session_at < now() - INTERVAL '7 days'` |

**RLS policies**

| Policy | Operation | Rule |
|---|---|---|
| users can manage own skills | ALL | `user_id = auth.uid()` |

**Grants**: `SELECT, INSERT, UPDATE, DELETE` to `authenticated`.

**Cascade**: DELETE on `user_skills` cascades to `session_logs`.

---

## session_logs

Append-only log of every training session. Rows are never deleted directly — only removed via cascade when the parent `user_skill` is deleted. See [ADR-006](../adr/ADR-006-session-logs-no-delete-policy.md).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| user_id | uuid | NOT NULL | — | FK user_profiles(id) ON DELETE CASCADE |
| skill_id | uuid | NOT NULL | — | FK user_skills(id) ON DELETE CASCADE |
| duration_minutes | integer | NOT NULL | — | CHECK > 0 |
| difficulty_multiplier | numeric(3,2) | NOT NULL | — | CHECK BETWEEN 0.5 AND 2.0 |
| xp_earned | integer | NOT NULL | — | |
| is_rest | boolean | NOT NULL | false | |
| notes | text | NULL | — | |
| logged_at | timestamptz | NOT NULL | now() | |
| session_date | date | NOT NULL | — | |

**Indexes**

| Columns | Purpose |
|---|---|
| (user_id, logged_at) | User session history feed, ordered by time |
| (skill_id, logged_at) | Per-skill history queries |
| (user_id, session_date) | Streak calculation: daily aggregation per user |

**RLS policies**

| Policy | Operation | Rule |
|---|---|---|
| users can view own session logs | SELECT | `user_id = auth.uid()` |
| users can insert own session logs | INSERT | `user_id = auth.uid()` WITH CHECK |

No DELETE policy. Deletion only via cascade from `user_skills`.

**Grants**: `SELECT, INSERT` to `authenticated`.

---

## Foreign key dependency order

```
auth.users
  └── user_profiles
        └── user_skills  (also references skill_categories)
              └── session_logs
```

Migration DOWN drops tables in reverse order: `session_logs` → `user_skills` → `skill_categories` → `user_profiles`.
