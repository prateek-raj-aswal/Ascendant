/**
 * S-006 — Database schema and migrations for Phase 1 entities
 *
 * These tests are written RED-first. No migration files exist yet.
 * They will fail until db/migrations/*.sql files are implemented.
 *
 * Strategy:
 *   - beforeAll: discover and execute all SQL files in db/migrations/ in
 *     lexicographic order (the conventional numbered-prefix ordering).
 *     Fail with a clear message if no migration files are found.
 *   - afterAll: tear down every table created by the migrations so the DB is
 *     left clean for repeated runs.
 *   - Each test group maps 1:1 to one Acceptance Criterion.
 *
 * RLS tests run inside an explicit transaction with SET LOCAL so the setting
 * is scoped to that transaction and does not leak between tests.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// DB connection — matches the project's local Docker Compose service
// ---------------------------------------------------------------------------
const DB_CONFIG: pg.PoolConfig = {
  host: "localhost",
  port: 5432,
  user: "kanban",
  password: "kanban_password_local",
  database: "ascendant",
};

const pool = new pg.Pool(DB_CONFIG);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Locate the db/migrations directory relative to the repo root. */
function migrationsDir(): string {
  // __dirname is not available in ESM; compute from import.meta.url
  const thisFile = fileURLToPath(import.meta.url);
  // api/src/__tests__/migration.test.ts → ../../../../db/migrations
  // 4 levels up: __tests__ → src → api → Personal (repo root)
  return path.resolve(thisFile, "../../../..", "db", "migrations");
}

/** Return SQL migration files sorted lexicographically (by filename). */
function getMigrationFiles(): string[] {
  const dir = migrationsDir();
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => path.join(dir, f));
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  const files = getMigrationFiles();

  if (files.length === 0) {
    throw new Error(
      `No SQL migration files found in ${migrationsDir()}. ` +
        "Create at least one .sql file in db/migrations/ before running these tests."
    );
  }

  const client = await pool.connect();
  try {
    for (const file of files) {
      const sql = fs.readFileSync(file, "utf8");
      // Only execute the UP section (everything before the -- DOWN marker).
      const upSql = sql.split(/^-- DOWN\s*$/m)[0];
      await client.query(upSql);
    }
  } finally {
    client.release();
  }
}, 60_000);

afterAll(async () => {
  const client = await pool.connect();
  try {
    // Drop all tables in reverse dependency order (phase2 first, then phase1).
    await client.query(`
      DROP TABLE IF EXISTS public.class_promotion_events CASCADE;
      DROP TABLE IF EXISTS public.quests            CASCADE;
      DROP TABLE IF EXISTS public.session_logs      CASCADE;
      DROP TABLE IF EXISTS public.user_skills       CASCADE;
      DROP TABLE IF EXISTS public.skill_categories  CASCADE;
      DROP TABLE IF EXISTS public.user_profiles     CASCADE;
    `);
  } finally {
    client.release();
  }
  await pool.end();
}, 30_000);

// ---------------------------------------------------------------------------
// TC-001 — AC-1: user_profiles table exists with required columns
// ---------------------------------------------------------------------------

describe("TC-001: user_profiles table structure", () => {
  it("has all required columns with correct data types", async () => {
    const res = await pool.query<{ column_name: string; data_type: string; is_nullable: string }>(
      `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'user_profiles'`
    );

    const cols = res.rows.reduce<Record<string, { data_type: string; is_nullable: string }>>(
      (acc, r) => {
        acc[r.column_name] = { data_type: r.data_type, is_nullable: r.is_nullable };
        return acc;
      },
      {}
    );

    // Primary key
    expect(cols).toHaveProperty("id");
    expect(cols.id.data_type).toBe("uuid");

    // Core profile columns
    expect(cols).toHaveProperty("display_name");
    expect(cols.display_name.data_type).toBe("character varying");

    expect(cols).toHaveProperty("avatar_seed");
    expect(cols.avatar_seed.data_type).toBe("character varying");

    expect(cols).toHaveProperty("class");
    expect(cols.class.data_type).toBe("character varying");

    expect(cols).toHaveProperty("total_xp");
    expect(cols.total_xp.data_type).toBe("integer");

    expect(cols).toHaveProperty("burnout_active");
    expect(cols.burnout_active.data_type).toBe("boolean");

    expect(cols).toHaveProperty("subscription_tier");
    expect(cols.subscription_tier.data_type).toBe("character varying");

    expect(cols).toHaveProperty("ai_calls_this_month");
    expect(cols.ai_calls_this_month.data_type).toBe("integer");

    expect(cols).toHaveProperty("ai_quota_reset_at");
    expect(cols.ai_quota_reset_at.data_type).toBe("timestamp with time zone");
    expect(cols.ai_quota_reset_at.is_nullable).toBe("NO");

    expect(cols).toHaveProperty("created_at");
    expect(cols.created_at.data_type).toBe("timestamp with time zone");

    expect(cols).toHaveProperty("updated_at");
    expect(cols.updated_at.data_type).toBe("timestamp with time zone");
  });

  it("has a foreign key referencing auth.users(id) with ON DELETE CASCADE", async () => {
    const res = await pool.query<{
      constraint_name: string;
      foreign_table_schema: string;
      foreign_table_name: string;
      delete_rule: string;
    }>(
      `SELECT rc.constraint_name,
              ccu.table_schema  AS foreign_table_schema,
              ccu.table_name    AS foreign_table_name,
              rc.delete_rule
         FROM information_schema.referential_constraints rc
         JOIN information_schema.key_column_usage kcu
           ON rc.constraint_name = kcu.constraint_name
          AND kcu.table_schema    = 'public'
          AND kcu.table_name      = 'user_profiles'
          AND kcu.column_name     = 'id'
         JOIN information_schema.constraint_column_usage ccu
           ON rc.unique_constraint_name = ccu.constraint_name`
    );

    expect(res.rows.length).toBeGreaterThanOrEqual(1);
    const fk = res.rows[0];
    expect(fk.foreign_table_schema).toBe("auth");
    expect(fk.foreign_table_name).toBe("users");
    expect(fk.delete_rule).toBe("CASCADE");
  });
});

// ---------------------------------------------------------------------------
// TC-002 — AC-1: skill_categories table exists with required columns
// ---------------------------------------------------------------------------

describe("TC-002: skill_categories table structure", () => {
  it("has id, name, display_order, created_at columns with correct types", async () => {
    const res = await pool.query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'skill_categories'`
    );

    const cols = res.rows.reduce<Record<string, string>>((acc, r) => {
      acc[r.column_name] = r.data_type;
      return acc;
    }, {});

    expect(cols).toHaveProperty("id");
    expect(cols.id).toBe("uuid");

    expect(cols).toHaveProperty("name");
    expect(cols.name).toBe("character varying");

    expect(cols).toHaveProperty("display_order");
    expect(cols.display_order).toBe("smallint");

    expect(cols).toHaveProperty("created_at");
    expect(cols.created_at).toBe("timestamp with time zone");
  });

  it("has a UNIQUE constraint on name", async () => {
    const res = await pool.query<{ constraint_type: string }>(
      `SELECT tc.constraint_type
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
          AND kcu.table_schema   = 'public'
          AND kcu.table_name     = 'skill_categories'
          AND kcu.column_name    = 'name'
        WHERE tc.table_schema = 'public'
          AND tc.table_name   = 'skill_categories'
          AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')`
    );

    const types = res.rows.map((r) => r.constraint_type);
    expect(types).toContain("UNIQUE");
  });
});

// ---------------------------------------------------------------------------
// TC-003 — AC-1: user_skills table exists with required columns and FKs
// ---------------------------------------------------------------------------

describe("TC-003: user_skills table structure", () => {
  it("has all required columns with correct data types and nullability", async () => {
    const res = await pool.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(
      `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'user_skills'`
    );

    const cols = res.rows.reduce<
      Record<string, { data_type: string; is_nullable: string }>
    >((acc, r) => {
      acc[r.column_name] = { data_type: r.data_type, is_nullable: r.is_nullable };
      return acc;
    }, {});

    expect(cols).toHaveProperty("id");
    expect(cols.id.data_type).toBe("uuid");

    expect(cols).toHaveProperty("user_id");
    expect(cols.user_id.data_type).toBe("uuid");
    expect(cols.user_id.is_nullable).toBe("NO");

    expect(cols).toHaveProperty("category_id");
    expect(cols.category_id.data_type).toBe("uuid");
    expect(cols.category_id.is_nullable).toBe("NO");

    expect(cols).toHaveProperty("name");
    expect(cols.name.data_type).toBe("character varying");
    expect(cols.name.is_nullable).toBe("NO");

    expect(cols).toHaveProperty("description");
    expect(cols.description.is_nullable).toBe("YES");

    expect(cols).toHaveProperty("current_xp");
    expect(cols.current_xp.data_type).toBe("integer");

    expect(cols).toHaveProperty("peak_xp");
    expect(cols.peak_xp.data_type).toBe("integer");

    expect(cols).toHaveProperty("last_session_at");
    expect(cols.last_session_at.is_nullable).toBe("YES");
  });

  it("has FK on user_id referencing user_profiles(id) ON DELETE CASCADE", async () => {
    const res = await pool.query<{
      foreign_table_name: string;
      foreign_column_name: string;
      delete_rule: string;
    }>(
      `SELECT ccu.table_name   AS foreign_table_name,
              ccu.column_name  AS foreign_column_name,
              rc.delete_rule
         FROM information_schema.referential_constraints rc
         JOIN information_schema.key_column_usage kcu
           ON rc.constraint_name = kcu.constraint_name
          AND kcu.table_schema   = 'public'
          AND kcu.table_name     = 'user_skills'
          AND kcu.column_name    = 'user_id'
         JOIN information_schema.constraint_column_usage ccu
           ON rc.unique_constraint_name = ccu.constraint_name`
    );

    expect(res.rows.length).toBeGreaterThanOrEqual(1);
    const fk = res.rows[0];
    expect(fk.foreign_table_name).toBe("user_profiles");
    expect(fk.delete_rule).toBe("CASCADE");
  });

  it("has FK on category_id referencing skill_categories(id) ON DELETE RESTRICT", async () => {
    const res = await pool.query<{
      foreign_table_name: string;
      delete_rule: string;
    }>(
      `SELECT ccu.table_name AS foreign_table_name,
              rc.delete_rule
         FROM information_schema.referential_constraints rc
         JOIN information_schema.key_column_usage kcu
           ON rc.constraint_name = kcu.constraint_name
          AND kcu.table_schema   = 'public'
          AND kcu.table_name     = 'user_skills'
          AND kcu.column_name    = 'category_id'
         JOIN information_schema.constraint_column_usage ccu
           ON rc.unique_constraint_name = ccu.constraint_name`
    );

    expect(res.rows.length).toBeGreaterThanOrEqual(1);
    const fk = res.rows[0];
    expect(fk.foreign_table_name).toBe("skill_categories");
    expect(fk.delete_rule).toBe("RESTRICT");
  });
});

// ---------------------------------------------------------------------------
// TC-004 — AC-1: session_logs table exists with required columns and FKs
// ---------------------------------------------------------------------------

describe("TC-004: session_logs table structure", () => {
  it("has all required columns with correct types and nullability", async () => {
    const res = await pool.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(
      `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'session_logs'`
    );

    const cols = res.rows.reduce<
      Record<string, { data_type: string; is_nullable: string }>
    >((acc, r) => {
      acc[r.column_name] = { data_type: r.data_type, is_nullable: r.is_nullable };
      return acc;
    }, {});

    expect(cols).toHaveProperty("id");
    expect(cols.id.data_type).toBe("uuid");

    expect(cols).toHaveProperty("user_id");
    expect(cols.user_id.data_type).toBe("uuid");
    expect(cols.user_id.is_nullable).toBe("NO");

    expect(cols).toHaveProperty("skill_id");
    expect(cols.skill_id.data_type).toBe("uuid");
    expect(cols.skill_id.is_nullable).toBe("NO");

    expect(cols).toHaveProperty("duration_minutes");
    expect(cols.duration_minutes.data_type).toBe("integer");
    expect(cols.duration_minutes.is_nullable).toBe("NO");

    expect(cols).toHaveProperty("difficulty_multiplier");
    expect(cols.difficulty_multiplier.data_type).toBe("numeric");
    expect(cols.difficulty_multiplier.is_nullable).toBe("NO");

    expect(cols).toHaveProperty("xp_earned");
    expect(cols.xp_earned.data_type).toBe("integer");
    expect(cols.xp_earned.is_nullable).toBe("NO");

    expect(cols).toHaveProperty("is_rest");
    expect(cols.is_rest.data_type).toBe("boolean");

    expect(cols).toHaveProperty("notes");
    expect(cols.notes.is_nullable).toBe("YES");

    expect(cols).toHaveProperty("logged_at");
    expect(cols.logged_at.data_type).toBe("timestamp with time zone");

    expect(cols).toHaveProperty("session_date");
    expect(cols.session_date.data_type).toBe("date");
    expect(cols.session_date.is_nullable).toBe("NO");
  });

  it("has FK on skill_id referencing user_skills(id) ON DELETE CASCADE", async () => {
    const res = await pool.query<{
      foreign_table_name: string;
      delete_rule: string;
    }>(
      `SELECT ccu.table_name AS foreign_table_name,
              rc.delete_rule
         FROM information_schema.referential_constraints rc
         JOIN information_schema.key_column_usage kcu
           ON rc.constraint_name = kcu.constraint_name
          AND kcu.table_schema   = 'public'
          AND kcu.table_name     = 'session_logs'
          AND kcu.column_name    = 'skill_id'
         JOIN information_schema.constraint_column_usage ccu
           ON rc.unique_constraint_name = ccu.constraint_name`
    );

    expect(res.rows.length).toBeGreaterThanOrEqual(1);
    const fk = res.rows[0];
    expect(fk.foreign_table_name).toBe("user_skills");
    expect(fk.delete_rule).toBe("CASCADE");
  });
});

// ---------------------------------------------------------------------------
// TC-005 — AC-1: required indexes exist on user_skills and session_logs
// ---------------------------------------------------------------------------

describe("TC-005: indexes on user_skills and session_logs", () => {
  it("user_skills has an index on user_id", async () => {
    const res = await pool.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef
         FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename  = 'user_skills'`
    );

    const defs = res.rows.map((r) => r.indexdef.toLowerCase());
    const hasUserIdIdx = defs.some((d) => d.includes("user_id"));
    expect(hasUserIdIdx).toBe(true);
  });

  it("user_skills has an index on last_session_at", async () => {
    const res = await pool.query<{ indexdef: string }>(
      `SELECT indexdef
         FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename  = 'user_skills'`
    );

    const defs = res.rows.map((r) => r.indexdef.toLowerCase());
    const hasLastSessionIdx = defs.some((d) => d.includes("last_session_at"));
    expect(hasLastSessionIdx).toBe(true);
  });

  it("user_skills has a composite index on (user_id, category_id)", async () => {
    const res = await pool.query<{ indexdef: string }>(
      `SELECT indexdef
         FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename  = 'user_skills'`
    );

    const defs = res.rows.map((r) => r.indexdef.toLowerCase());
    const hasIdx = defs.some(
      (d) => d.includes("user_id") && d.includes("category_id")
    );
    expect(hasIdx).toBe(true);
  });

  it("session_logs has a composite index on (user_id, logged_at)", async () => {
    const res = await pool.query<{ indexdef: string }>(
      `SELECT indexdef
         FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename  = 'session_logs'`
    );

    const defs = res.rows.map((r) => r.indexdef.toLowerCase());
    const hasCompositeIdx = defs.some(
      (d) => d.includes("user_id") && d.includes("logged_at")
    );
    expect(hasCompositeIdx).toBe(true);
  });

  it("session_logs has a composite index on (skill_id, logged_at)", async () => {
    const res = await pool.query<{ indexdef: string }>(
      `SELECT indexdef
         FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename  = 'session_logs'`
    );

    const defs = res.rows.map((r) => r.indexdef.toLowerCase());
    const hasIdx = defs.some(
      (d) => d.includes("skill_id") && d.includes("logged_at")
    );
    expect(hasIdx).toBe(true);
  });

  it("session_logs has a composite index on (user_id, session_date)", async () => {
    const res = await pool.query<{ indexdef: string }>(
      `SELECT indexdef
         FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename  = 'session_logs'`
    );

    const defs = res.rows.map((r) => r.indexdef.toLowerCase());
    const hasIdx = defs.some(
      (d) => d.includes("user_id") && d.includes("session_date")
    );
    expect(hasIdx).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TC-006 — AC-2: RLS on user_skills — user A cannot see user B's skills
// ---------------------------------------------------------------------------

describe("TC-006: RLS on user_skills isolates rows by user", () => {
  it("a user querying user_skills only sees their own rows", async () => {
    // We need two auth.users rows. Insert them directly (test environment
    // privilege allows bypassing normal auth flow).
    const userAId = "a0000000-0000-0000-0000-000000000001";
    const userBId = "b0000000-0000-0000-0000-000000000002";

    const client = await pool.connect();
    try {
      // Insert auth.users rows for both test users (ignore conflict if already present).
      await client.query(`
        INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
        VALUES
          ('${userAId}', 'user_a_rls@test.local', 'x', now(), now()),
          ('${userBId}', 'user_b_rls@test.local', 'x', now(), now())
        ON CONFLICT (id) DO NOTHING
      `);

      // Insert user_profiles for both.
      await client.query(`
        INSERT INTO public.user_profiles (id, display_name, avatar_seed, ai_quota_reset_at)
        VALUES
          ('${userAId}', 'User A', 'seed_a', now()),
          ('${userBId}', 'User B', 'seed_b', now())
        ON CONFLICT (id) DO NOTHING
      `);

      // Grab a skill_category id to satisfy the FK.
      const catRes = await client.query<{ id: string }>(
        `SELECT id FROM public.skill_categories LIMIT 1`
      );
      const categoryId = catRes.rows[0].id;

      // Insert one skill per user (bypassing RLS as the superuser pool).
      await client.query(`
        INSERT INTO public.user_skills (id, user_id, category_id, name)
        VALUES
          (gen_random_uuid(), '${userAId}', '${categoryId}', 'Skill of A'),
          (gen_random_uuid(), '${userBId}', '${categoryId}', 'Skill of B')
        ON CONFLICT DO NOTHING
      `);

      // Now simulate user A's RLS context within a transaction.
      await client.query("BEGIN");
      await client.query(`SET LOCAL "request.jwt.claim.sub" = '${userAId}'`);
      // SET LOCAL ROLE to the application role that has RLS enforced.
      await client.query("SET LOCAL ROLE authenticated");

      const visibleRes = await client.query<{ name: string; user_id: string }>(
        `SELECT name, user_id FROM public.user_skills`
      );

      await client.query("ROLLBACK");

      // User A should only see their own skill.
      const visibleNames = visibleRes.rows.map((r) => r.name);
      expect(visibleNames).toContain("Skill of A");
      expect(visibleNames).not.toContain("Skill of B");

      // Every visible row must belong to user A.
      for (const row of visibleRes.rows) {
        expect(row.user_id).toBe(userAId);
      }
    } finally {
      // Clean up test data (as superuser — no RLS).
      await client.query(`
        DELETE FROM public.user_skills
         WHERE user_id IN ('${userAId}', '${userBId}');
        DELETE FROM public.user_profiles
         WHERE id IN ('${userAId}', '${userBId}');
        DELETE FROM auth.users
         WHERE id IN ('${userAId}', '${userBId}');
      `);
      client.release();
    }
  });
});

// ---------------------------------------------------------------------------
// TC-007 — AC-3: RLS on session_logs — insert rejected if user_id != auth user
// ---------------------------------------------------------------------------

describe("TC-007: RLS on session_logs rejects insert for wrong user_id", () => {
  it("inserting a session_log with a mismatched user_id raises an error", async () => {
    const realUserId = "c0000000-0000-0000-0000-000000000003";
    const otherUserId = "d0000000-0000-0000-0000-000000000004";

    const client = await pool.connect();
    try {
      // Create auth.users and profiles for BOTH users so the FK on session_logs.user_id
      // is satisfied. Only RLS (not FK) should block the mismatched insert.
      await client.query(`
        INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
        VALUES
          ('${realUserId}',  'real_user_rls@test.local',  'x', now(), now()),
          ('${otherUserId}', 'other_user_rls@test.local', 'x', now(), now())
        ON CONFLICT (id) DO NOTHING
      `);
      await client.query(`
        INSERT INTO public.user_profiles (id, display_name, avatar_seed, ai_quota_reset_at)
        VALUES
          ('${realUserId}',  'Real User',  'seed_real',  now()),
          ('${otherUserId}', 'Other User', 'seed_other', now())
        ON CONFLICT (id) DO NOTHING
      `);

      const catRes = await client.query<{ id: string }>(
        `SELECT id FROM public.skill_categories LIMIT 1`
      );
      const categoryId = catRes.rows[0].id;

      // Insert a skill for the real user (as superuser, bypassing RLS).
      const skillRes = await client.query<{ id: string }>(
        `INSERT INTO public.user_skills (id, user_id, category_id, name)
              VALUES (gen_random_uuid(), '${realUserId}', '${categoryId}', 'Test Skill')
           RETURNING id`
      );
      const skillId = skillRes.rows[0].id;

      // Simulate authenticated as realUserId, but try to insert a session_log
      // with user_id = otherUserId (a mismatch).
      await client.query("BEGIN");
      await client.query(`SET LOCAL "request.jwt.claim.sub" = '${realUserId}'`);
      await client.query("SET LOCAL ROLE authenticated");

      let insertError: Error | null = null;
      try {
        await client.query(`
          INSERT INTO public.session_logs
            (user_id, skill_id, duration_minutes, difficulty_multiplier, xp_earned, session_date)
          VALUES
            ('${otherUserId}', '${skillId}', 30, 1.0, 10, CURRENT_DATE)
        `);
      } catch (err) {
        insertError = err as Error;
      }

      await client.query("ROLLBACK");

      // The insert must have been rejected by RLS (code 42501), not FK.
      expect(insertError).not.toBeNull();
      expect((insertError as unknown as { code?: string }).code).toBe("42501");
    } finally {
      await client.query(`
        DELETE FROM public.session_logs WHERE user_id IN ('${realUserId}', '${otherUserId}');
        DELETE FROM public.user_skills   WHERE user_id IN ('${realUserId}', '${otherUserId}');
        DELETE FROM public.user_profiles WHERE id      IN ('${realUserId}', '${otherUserId}');
        DELETE FROM auth.users           WHERE id      IN ('${realUserId}', '${otherUserId}');
      `);
      client.release();
    }
  });
});

// ---------------------------------------------------------------------------
// TC-008 — AC-4: seed data — skill_categories has exactly 4 rows
// ---------------------------------------------------------------------------

describe("TC-008: skill_categories seed data", () => {
  it("contains exactly 4 rows: Body, Mind, Craft, Spirit", async () => {
    const res = await pool.query<{ name: string; display_order: number }>(
      `SELECT name, display_order
         FROM public.skill_categories
        ORDER BY display_order`
    );

    expect(res.rows).toHaveLength(4);

    expect(res.rows[0]).toMatchObject({ name: "Body", display_order: 1 });
    expect(res.rows[1]).toMatchObject({ name: "Mind", display_order: 2 });
    expect(res.rows[2]).toMatchObject({ name: "Craft", display_order: 3 });
    expect(res.rows[3]).toMatchObject({ name: "Spirit", display_order: 4 });
  });
});

// ---------------------------------------------------------------------------
// TC-009 — AC-5: cascade delete — deleting user_skill deletes its session_logs
// ---------------------------------------------------------------------------

describe("TC-009: cascade delete from user_skills to session_logs", () => {
  it("deleting a user_skill also deletes all of its session_logs", async () => {
    const userId = "e0000000-0000-0000-0000-000000000005";

    const client = await pool.connect();
    try {
      // Set up: auth user + profile + skill + two session_logs.
      await client.query(`
        INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
        VALUES ('${userId}', 'cascade_test@test.local', 'x', now(), now())
        ON CONFLICT (id) DO NOTHING
      `);
      await client.query(`
        INSERT INTO public.user_profiles (id, display_name, avatar_seed, ai_quota_reset_at)
        VALUES ('${userId}', 'Cascade Test', 'seed_c', now())
        ON CONFLICT (id) DO NOTHING
      `);

      const catRes = await client.query<{ id: string }>(
        `SELECT id FROM public.skill_categories LIMIT 1`
      );
      const categoryId = catRes.rows[0].id;

      const skillRes = await client.query<{ id: string }>(
        `INSERT INTO public.user_skills (id, user_id, category_id, name)
              VALUES (gen_random_uuid(), '${userId}', '${categoryId}', 'Cascade Skill')
           RETURNING id`
      );
      const skillId = skillRes.rows[0].id;

      // Insert two session_logs for that skill.
      await client.query(`
        INSERT INTO public.session_logs
          (user_id, skill_id, duration_minutes, difficulty_multiplier, xp_earned, session_date)
        VALUES
          ('${userId}', '${skillId}', 30, 1.0, 10, CURRENT_DATE),
          ('${userId}', '${skillId}', 45, 1.5, 20, CURRENT_DATE)
      `);

      // Confirm they exist before deletion.
      const beforeRes = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM public.session_logs WHERE skill_id = '${skillId}'`
      );
      expect(Number(beforeRes.rows[0].count)).toBe(2);

      // Delete the skill — cascade must propagate.
      await client.query(
        `DELETE FROM public.user_skills WHERE id = '${skillId}'`
      );

      // session_logs for that skill must be gone.
      const afterRes = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM public.session_logs WHERE skill_id = '${skillId}'`
      );
      expect(Number(afterRes.rows[0].count)).toBe(0);
    } finally {
      await client.query(`
        DELETE FROM public.user_skills   WHERE user_id = '${userId}';
        DELETE FROM public.user_profiles WHERE id      = '${userId}';
        DELETE FROM auth.users           WHERE id      = '${userId}';
      `);
      client.release();
    }
  });
});
