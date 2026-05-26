/**
 * S-014 — Phase 2/3 schema additions
 *
 * Tests the quests and class_promotion_events tables created by
 * db/migrations/002_phase2_schema.sql.
 *
 * Strategy: run ALL migration files (001 + 002) in beforeAll, then verify
 * the Phase 2 tables. afterAll drops all tables in dependency order.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const DB_CONFIG: pg.PoolConfig = {
  host: "localhost",
  port: 5432,
  user: "kanban",
  password: "kanban_password_local",
  database: "ascendant",
};

const pool = new pg.Pool(DB_CONFIG);

function migrationsDir(): string {
  const thisFile = fileURLToPath(import.meta.url);
  return path.resolve(thisFile, "../../../..", "db", "migrations");
}

function getMigrationFiles(): string[] {
  const dir = migrationsDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => path.join(dir, f));
}

beforeAll(async () => {
  const files = getMigrationFiles();
  if (files.length === 0) throw new Error("No migration files found.");

  const client = await pool.connect();
  try {
    for (const file of files) {
      const sql = fs.readFileSync(file, "utf8");
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
    await client.query(`
      DROP TABLE IF EXISTS public.class_promotion_events CASCADE;
      DROP TABLE IF EXISTS public.quests CASCADE;
      DROP TABLE IF EXISTS public.session_logs  CASCADE;
      DROP TABLE IF EXISTS public.user_skills   CASCADE;
      DROP TABLE IF EXISTS public.skill_categories CASCADE;
      DROP TABLE IF EXISTS public.user_profiles CASCADE;
    `);
  } finally {
    client.release();
  }
  await pool.end();
}, 30_000);

// ---------------------------------------------------------------------------
// TC-S014-001: quests table exists
// ---------------------------------------------------------------------------

describe("TC-S014-001: quests table exists", () => {
  it("to_regclass resolves public.quests", async () => {
    const res = await pool.query<{ regclass: string | null }>(
      `SELECT to_regclass('public.quests') AS regclass`
    );
    expect(res.rows[0].regclass).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// TC-S014-002: class_promotion_events table exists
// ---------------------------------------------------------------------------

describe("TC-S014-002: class_promotion_events table exists", () => {
  it("to_regclass resolves public.class_promotion_events", async () => {
    const res = await pool.query<{ regclass: string | null }>(
      `SELECT to_regclass('public.class_promotion_events') AS regclass`
    );
    expect(res.rows[0].regclass).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// TC-S014-003: quests columns match schema
// ---------------------------------------------------------------------------

describe("TC-S014-003: quests columns", () => {
  it("has all required columns with correct types", async () => {
    const res = await pool.query<{ column_name: string; data_type: string; is_nullable: string }>(
      `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'quests'`
    );

    const cols = res.rows.reduce<Record<string, { data_type: string; is_nullable: string }>>(
      (acc, r) => { acc[r.column_name] = { data_type: r.data_type, is_nullable: r.is_nullable }; return acc; },
      {}
    );

    expect(cols).toHaveProperty("id");
    expect(cols.id.data_type).toBe("uuid");

    expect(cols).toHaveProperty("user_id");
    expect(cols.user_id.data_type).toBe("uuid");
    expect(cols.user_id.is_nullable).toBe("NO");

    expect(cols).toHaveProperty("skill_id");
    expect(cols.skill_id.data_type).toBe("uuid");
    expect(cols.skill_id.is_nullable).toBe("YES");

    expect(cols).toHaveProperty("title");
    expect(cols.title.data_type).toBe("text");
    expect(cols.title.is_nullable).toBe("NO");

    expect(cols).toHaveProperty("description");
    expect(cols.description.is_nullable).toBe("YES");

    expect(cols).toHaveProperty("difficulty");
    expect(cols.difficulty.data_type).toBe("integer");
    expect(cols.difficulty.is_nullable).toBe("NO");

    expect(cols).toHaveProperty("xp_reward");
    expect(cols.xp_reward.data_type).toBe("integer");

    expect(cols).toHaveProperty("quest_type");
    expect(cols.quest_type.data_type).toBe("text");
    expect(cols.quest_type.is_nullable).toBe("NO");

    expect(cols).toHaveProperty("status");
    expect(cols.status.data_type).toBe("text");
    expect(cols.status.is_nullable).toBe("NO");

    expect(cols).toHaveProperty("deadline");
    expect(cols.deadline.data_type).toBe("timestamp with time zone");
    expect(cols.deadline.is_nullable).toBe("YES");

    expect(cols).toHaveProperty("completed_at");
    expect(cols.completed_at.is_nullable).toBe("YES");

    expect(cols).toHaveProperty("created_at");
    expect(cols).toHaveProperty("updated_at");
  });
});

// ---------------------------------------------------------------------------
// TC-S014-004: class_promotion_events columns match schema
// ---------------------------------------------------------------------------

describe("TC-S014-004: class_promotion_events columns", () => {
  it("has all required columns with correct types", async () => {
    const res = await pool.query<{ column_name: string; data_type: string; is_nullable: string }>(
      `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'class_promotion_events'`
    );

    const cols = res.rows.reduce<Record<string, { data_type: string; is_nullable: string }>>(
      (acc, r) => { acc[r.column_name] = { data_type: r.data_type, is_nullable: r.is_nullable }; return acc; },
      {}
    );

    expect(cols).toHaveProperty("id");
    expect(cols.id.data_type).toBe("uuid");

    expect(cols).toHaveProperty("user_id");
    expect(cols.user_id.data_type).toBe("uuid");
    expect(cols.user_id.is_nullable).toBe("NO");

    expect(cols).toHaveProperty("from_class");
    expect(cols.from_class.data_type).toBe("text");
    expect(cols.from_class.is_nullable).toBe("NO");

    expect(cols).toHaveProperty("to_class");
    expect(cols.to_class.data_type).toBe("text");
    expect(cols.to_class.is_nullable).toBe("NO");

    expect(cols).toHaveProperty("total_xp_at_promotion");
    expect(cols.total_xp_at_promotion.data_type).toBe("integer");
    expect(cols.total_xp_at_promotion.is_nullable).toBe("NO");

    expect(cols).toHaveProperty("viewed");
    expect(cols.viewed.data_type).toBe("boolean");
    expect(cols.viewed.is_nullable).toBe("NO");

    expect(cols).toHaveProperty("promoted_at");
    expect(cols.promoted_at.data_type).toBe("timestamp with time zone");
    expect(cols.promoted_at.is_nullable).toBe("NO");
  });
});

// ---------------------------------------------------------------------------
// TC-S014-005: quests CHECK constraints enforced
// ---------------------------------------------------------------------------

describe("TC-S014-005: quests CHECK constraints", () => {
  it("difficulty must be between 1 and 5", async () => {
    const userId = "f0000000-0000-0000-0000-000000000010";
    const client = await pool.connect();
    try {
      await client.query(`
        INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
        VALUES ('${userId}', 'quest_check@test.local', 'x', now(), now())
        ON CONFLICT (id) DO NOTHING
      `);
      await client.query(`
        INSERT INTO public.user_profiles (id, display_name, avatar_seed, ai_quota_reset_at)
        VALUES ('${userId}', 'Quest Check', 'seed_q', now())
        ON CONFLICT (id) DO NOTHING
      `);

      let err: Error | null = null;
      try {
        await client.query(`
          INSERT INTO public.quests (user_id, title, difficulty, quest_type)
          VALUES ('${userId}', 'Bad Quest', 0, 'daily')
        `);
      } catch (e) { err = e as Error; }
      expect(err).not.toBeNull();

      err = null;
      try {
        await client.query(`
          INSERT INTO public.quests (user_id, title, difficulty, quest_type)
          VALUES ('${userId}', 'Bad Quest 2', 6, 'daily')
        `);
      } catch (e) { err = e as Error; }
      expect(err).not.toBeNull();
    } finally {
      await client.query(`
        DELETE FROM public.quests       WHERE user_id = '${userId}';
        DELETE FROM public.user_profiles WHERE id = '${userId}';
        DELETE FROM auth.users           WHERE id = '${userId}';
      `);
      client.release();
    }
  });

  it("quest_type must be daily, weekly, or one_time", async () => {
    const userId = "f0000000-0000-0000-0000-000000000011";
    const client = await pool.connect();
    try {
      await client.query(`
        INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
        VALUES ('${userId}', 'quest_type_check@test.local', 'x', now(), now())
        ON CONFLICT (id) DO NOTHING
      `);
      await client.query(`
        INSERT INTO public.user_profiles (id, display_name, avatar_seed, ai_quota_reset_at)
        VALUES ('${userId}', 'Quest Type Check', 'seed_qt', now())
        ON CONFLICT (id) DO NOTHING
      `);

      let err: Error | null = null;
      try {
        await client.query(`
          INSERT INTO public.quests (user_id, title, difficulty, quest_type)
          VALUES ('${userId}', 'Invalid Type', 3, 'monthly')
        `);
      } catch (e) { err = e as Error; }
      expect(err).not.toBeNull();
    } finally {
      await client.query(`
        DELETE FROM public.quests        WHERE user_id = '${userId}';
        DELETE FROM public.user_profiles WHERE id = '${userId}';
        DELETE FROM auth.users           WHERE id = '${userId}';
      `);
      client.release();
    }
  });

  it("status must be active, completed, or failed", async () => {
    const userId = "f0000000-0000-0000-0000-000000000012";
    const client = await pool.connect();
    try {
      await client.query(`
        INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
        VALUES ('${userId}', 'quest_status_check@test.local', 'x', now(), now())
        ON CONFLICT (id) DO NOTHING
      `);
      await client.query(`
        INSERT INTO public.user_profiles (id, display_name, avatar_seed, ai_quota_reset_at)
        VALUES ('${userId}', 'Quest Status Check', 'seed_qs', now())
        ON CONFLICT (id) DO NOTHING
      `);

      let err: Error | null = null;
      try {
        await client.query(`
          INSERT INTO public.quests (user_id, title, difficulty, quest_type, status)
          VALUES ('${userId}', 'Invalid Status', 3, 'daily', 'archived')
        `);
      } catch (e) { err = e as Error; }
      expect(err).not.toBeNull();
    } finally {
      await client.query(`
        DELETE FROM public.quests        WHERE user_id = '${userId}';
        DELETE FROM public.user_profiles WHERE id = '${userId}';
        DELETE FROM auth.users           WHERE id = '${userId}';
      `);
      client.release();
    }
  });
});

// ---------------------------------------------------------------------------
// TC-S014-006: quests FK to user_profiles ON DELETE CASCADE
// ---------------------------------------------------------------------------

describe("TC-S014-006: quests cascade delete from user_profiles", () => {
  it("deleting user_profiles row cascades to quests", async () => {
    const userId = "f0000000-0000-0000-0000-000000000013";
    const client = await pool.connect();
    try {
      await client.query(`
        INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
        VALUES ('${userId}', 'quest_cascade@test.local', 'x', now(), now())
        ON CONFLICT (id) DO NOTHING
      `);
      await client.query(`
        INSERT INTO public.user_profiles (id, display_name, avatar_seed, ai_quota_reset_at)
        VALUES ('${userId}', 'Cascade Quest', 'seed_cq', now())
        ON CONFLICT (id) DO NOTHING
      `);
      await client.query(`
        INSERT INTO public.quests (user_id, title, difficulty, quest_type)
        VALUES ('${userId}', 'Quest to cascade', 3, 'daily')
      `);

      const before = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM public.quests WHERE user_id = '${userId}'`
      );
      expect(Number(before.rows[0].count)).toBe(1);

      await client.query(`DELETE FROM public.user_profiles WHERE id = '${userId}'`);

      const after = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM public.quests WHERE user_id = '${userId}'`
      );
      expect(Number(after.rows[0].count)).toBe(0);
    } finally {
      await client.query(`DELETE FROM auth.users WHERE id = '${userId}'`);
      client.release();
    }
  });
});

// ---------------------------------------------------------------------------
// TC-S014-007: quests FK to user_skills ON DELETE SET NULL
// ---------------------------------------------------------------------------

describe("TC-S014-007: quests skill_id set null on skill delete", () => {
  it("deleting a user_skill sets quests.skill_id to NULL", async () => {
    const userId = "f0000000-0000-0000-0000-000000000014";
    const client = await pool.connect();
    try {
      await client.query(`
        INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
        VALUES ('${userId}', 'quest_setnull@test.local', 'x', now(), now())
        ON CONFLICT (id) DO NOTHING
      `);
      await client.query(`
        INSERT INTO public.user_profiles (id, display_name, avatar_seed, ai_quota_reset_at)
        VALUES ('${userId}', 'Set Null Quest', 'seed_sn', now())
        ON CONFLICT (id) DO NOTHING
      `);

      const catRes = await client.query<{ id: string }>(
        `SELECT id FROM public.skill_categories LIMIT 1`
      );
      const categoryId = catRes.rows[0].id;

      const skillRes = await client.query<{ id: string }>(
        `INSERT INTO public.user_skills (id, user_id, category_id, name)
         VALUES (gen_random_uuid(), '${userId}', '${categoryId}', 'Skill for Quest')
         RETURNING id`
      );
      const skillId = skillRes.rows[0].id;

      const questRes = await client.query<{ id: string }>(
        `INSERT INTO public.quests (user_id, skill_id, title, difficulty, quest_type)
         VALUES ('${userId}', '${skillId}', 'Skill Quest', 3, 'weekly')
         RETURNING id`
      );
      const questId = questRes.rows[0].id;

      await client.query(`DELETE FROM public.user_skills WHERE id = '${skillId}'`);

      const after = await client.query<{ skill_id: string | null }>(
        `SELECT skill_id FROM public.quests WHERE id = '${questId}'`
      );
      expect(after.rows[0].skill_id).toBeNull();
    } finally {
      await client.query(`
        DELETE FROM public.quests        WHERE user_id = '${userId}';
        DELETE FROM public.user_profiles WHERE id = '${userId}';
        DELETE FROM auth.users           WHERE id = '${userId}';
      `);
      client.release();
    }
  });
});

// ---------------------------------------------------------------------------
// TC-S014-008: class_promotion_events FK to user_profiles ON DELETE CASCADE
// ---------------------------------------------------------------------------

describe("TC-S014-008: class_promotion_events cascade delete from user_profiles", () => {
  it("deleting user_profiles row cascades to class_promotion_events", async () => {
    const userId = "f0000000-0000-0000-0000-000000000015";
    const client = await pool.connect();
    try {
      await client.query(`
        INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
        VALUES ('${userId}', 'promo_cascade@test.local', 'x', now(), now())
        ON CONFLICT (id) DO NOTHING
      `);
      await client.query(`
        INSERT INTO public.user_profiles (id, display_name, avatar_seed, ai_quota_reset_at)
        VALUES ('${userId}', 'Promo Cascade', 'seed_pc', now())
        ON CONFLICT (id) DO NOTHING
      `);
      await client.query(`
        INSERT INTO public.class_promotion_events (user_id, from_class, to_class, total_xp_at_promotion)
        VALUES ('${userId}', 'shadow_novice', 'iron_apprentice', 500)
      `);

      const before = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM public.class_promotion_events WHERE user_id = '${userId}'`
      );
      expect(Number(before.rows[0].count)).toBe(1);

      await client.query(`DELETE FROM public.user_profiles WHERE id = '${userId}'`);

      const after = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM public.class_promotion_events WHERE user_id = '${userId}'`
      );
      expect(Number(after.rows[0].count)).toBe(0);
    } finally {
      await client.query(`DELETE FROM auth.users WHERE id = '${userId}'`);
      client.release();
    }
  });
});

// ---------------------------------------------------------------------------
// TC-S014-009: quests RLS blocks cross-user operations
// ---------------------------------------------------------------------------

describe("TC-S014-009: quests RLS isolates rows by user", () => {
  it("authenticated user can only see their own quests", async () => {
    const userA = "f0000000-0000-0000-0000-000000000016";
    const userB = "f0000000-0000-0000-0000-000000000017";
    const client = await pool.connect();
    try {
      await client.query(`
        INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
        VALUES
          ('${userA}', 'quest_rls_a@test.local', 'x', now(), now()),
          ('${userB}', 'quest_rls_b@test.local', 'x', now(), now())
        ON CONFLICT (id) DO NOTHING
      `);
      await client.query(`
        INSERT INTO public.user_profiles (id, display_name, avatar_seed, ai_quota_reset_at)
        VALUES
          ('${userA}', 'Quest RLS A', 'seed_rla', now()),
          ('${userB}', 'Quest RLS B', 'seed_rlb', now())
        ON CONFLICT (id) DO NOTHING
      `);
      await client.query(`
        INSERT INTO public.quests (user_id, title, difficulty, quest_type)
        VALUES
          ('${userA}', 'Quest of A', 3, 'daily'),
          ('${userB}', 'Quest of B', 3, 'daily')
      `);

      await client.query("BEGIN");
      await client.query(`SET LOCAL "request.jwt.claim.sub" = '${userA}'`);
      await client.query("SET LOCAL ROLE authenticated");

      const res = await client.query<{ title: string }>(
        `SELECT title FROM public.quests`
      );
      await client.query("ROLLBACK");

      const titles = res.rows.map((r) => r.title);
      expect(titles).toContain("Quest of A");
      expect(titles).not.toContain("Quest of B");
    } finally {
      await client.query(`
        DELETE FROM public.quests        WHERE user_id IN ('${userA}', '${userB}');
        DELETE FROM public.user_profiles WHERE id      IN ('${userA}', '${userB}');
        DELETE FROM auth.users           WHERE id      IN ('${userA}', '${userB}');
      `);
      client.release();
    }
  });
});

// ---------------------------------------------------------------------------
// TC-S014-010/011: class_promotion_events RLS blocks UPDATE and DELETE
// ---------------------------------------------------------------------------

describe("TC-S014-010/011: class_promotion_events RLS is immutable", () => {
  it("authenticated user cannot UPDATE a promotion event", async () => {
    const userId = "f0000000-0000-0000-0000-000000000018";
    const client = await pool.connect();
    try {
      await client.query(`
        INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
        VALUES ('${userId}', 'promo_immutable@test.local', 'x', now(), now())
        ON CONFLICT (id) DO NOTHING
      `);
      await client.query(`
        INSERT INTO public.user_profiles (id, display_name, avatar_seed, ai_quota_reset_at)
        VALUES ('${userId}', 'Promo Immutable', 'seed_pi', now())
        ON CONFLICT (id) DO NOTHING
      `);
      const promoRes = await client.query<{ id: string }>(
        `INSERT INTO public.class_promotion_events (user_id, from_class, to_class, total_xp_at_promotion)
         VALUES ('${userId}', 'shadow_novice', 'iron_apprentice', 100)
         RETURNING id`
      );
      const promoId = promoRes.rows[0].id;

      await client.query("BEGIN");
      await client.query(`SET LOCAL "request.jwt.claim.sub" = '${userId}'`);
      await client.query("SET LOCAL ROLE authenticated");

      let err: Error | null = null;
      try {
        await client.query(
          `UPDATE public.class_promotion_events SET viewed = true WHERE id = '${promoId}'`
        );
      } catch (e) { err = e as Error; }

      await client.query("ROLLBACK");

      expect(err).not.toBeNull();
      expect((err as unknown as { code?: string }).code).toBe("42501");
    } finally {
      await client.query(`
        DELETE FROM public.class_promotion_events WHERE user_id = '${userId}';
        DELETE FROM public.user_profiles          WHERE id      = '${userId}';
        DELETE FROM auth.users                    WHERE id      = '${userId}';
      `);
      client.release();
    }
  });

  it("authenticated user cannot DELETE a promotion event", async () => {
    const userId = "f0000000-0000-0000-0000-000000000019";
    const client = await pool.connect();
    try {
      await client.query(`
        INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
        VALUES ('${userId}', 'promo_nodelete@test.local', 'x', now(), now())
        ON CONFLICT (id) DO NOTHING
      `);
      await client.query(`
        INSERT INTO public.user_profiles (id, display_name, avatar_seed, ai_quota_reset_at)
        VALUES ('${userId}', 'Promo NoDelete', 'seed_nd', now())
        ON CONFLICT (id) DO NOTHING
      `);
      const promoRes = await client.query<{ id: string }>(
        `INSERT INTO public.class_promotion_events (user_id, from_class, to_class, total_xp_at_promotion)
         VALUES ('${userId}', 'shadow_novice', 'iron_apprentice', 200)
         RETURNING id`
      );
      const promoId = promoRes.rows[0].id;

      await client.query("BEGIN");
      await client.query(`SET LOCAL "request.jwt.claim.sub" = '${userId}'`);
      await client.query("SET LOCAL ROLE authenticated");

      let err: Error | null = null;
      try {
        await client.query(
          `DELETE FROM public.class_promotion_events WHERE id = '${promoId}'`
        );
      } catch (e) { err = e as Error; }

      await client.query("ROLLBACK");

      expect(err).not.toBeNull();
      expect((err as unknown as { code?: string }).code).toBe("42501");
    } finally {
      await client.query(`
        DELETE FROM public.class_promotion_events WHERE user_id = '${userId}';
        DELETE FROM public.user_profiles          WHERE id      = '${userId}';
        DELETE FROM auth.users                    WHERE id      = '${userId}';
      `);
      client.release();
    }
  });
});

// ---------------------------------------------------------------------------
// TC-S014-012/013: Indexes exist
// ---------------------------------------------------------------------------

describe("TC-S014-012: quests indexes exist", () => {
  it("has indexes on user_id, status, and skill_id", async () => {
    const res = await pool.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'quests'`
    );
    const defs = res.rows.map((r) => r.indexdef.toLowerCase());
    expect(defs.some((d) => d.includes("user_id"))).toBe(true);
    expect(defs.some((d) => d.includes("status"))).toBe(true);
    expect(defs.some((d) => d.includes("skill_id"))).toBe(true);
  });
});

describe("TC-S014-013: class_promotion_events indexes exist", () => {
  it("has indexes on user_id and promoted_at", async () => {
    const res = await pool.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'class_promotion_events'`
    );
    const defs = res.rows.map((r) => r.indexdef.toLowerCase());
    expect(defs.some((d) => d.includes("user_id"))).toBe(true);
    expect(defs.some((d) => d.includes("promoted_at"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TC-S014-014: DOWN migration drops both tables
// ---------------------------------------------------------------------------

describe("TC-S014-014: DOWN migration drops tables", () => {
  it("quests and class_promotion_events are gone after DROP", async () => {
    const client = await pool.connect();
    try {
      await client.query(`
        DROP TABLE IF EXISTS public.class_promotion_events CASCADE;
        DROP TABLE IF EXISTS public.quests CASCADE;
      `);

      const questsRes = await client.query<{ regclass: string | null }>(
        `SELECT to_regclass('public.quests') AS regclass`
      );
      const promoRes = await client.query<{ regclass: string | null }>(
        `SELECT to_regclass('public.class_promotion_events') AS regclass`
      );

      expect(questsRes.rows[0].regclass).toBeNull();
      expect(promoRes.rows[0].regclass).toBeNull();
    } finally {
      client.release();
    }
  });
});
