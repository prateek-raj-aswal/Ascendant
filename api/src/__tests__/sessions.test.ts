/**
 * S-004 — Log a training session
 * API contract tests (Vitest + supertest)
 *
 * Tests are written RED-first. Sessions routes/service do not exist yet.
 *
 * Auth pattern: signup → login → Bearer token
 * Profile pattern: POST /api/profile/onboard (required for total_xp tracking)
 * Skill pattern: POST /api/skills to create a skill to log against
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { app } from "../app.js";

let request: ReturnType<typeof supertest>;

beforeAll(async () => {
  await app.ready();
  request = supertest(app.server);
});

afterAll(async () => {
  await app.close();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let counter = 0;

function uniqueEmail(): string {
  return `sessions-test-${++counter}-${Date.now()}@example.com`;
}

const BODY_CATEGORY_ID = "00000000-0000-0000-0000-000000000001";

async function registerAndLogin(email: string, password = "ValidPass1"): Promise<string> {
  await request
    .post("/api/auth/signup")
    .send({ email, password })
    .set("Content-Type", "application/json");

  const loginRes = await request
    .post("/api/auth/login")
    .send({ email, password })
    .set("Content-Type", "application/json");

  return (loginRes.body as { access_token: string }).access_token;
}

async function registerLoginAndOnboard(
  email: string,
  password = "ValidPass1"
): Promise<string> {
  const token = await registerAndLogin(email, password);

  await request
    .post("/api/profile/onboard")
    .set("Authorization", `Bearer ${token}`)
    .set("Content-Type", "application/json")
    .send({ display_name: "Test User", avatar_seed: "test_seed" });

  return token;
}

async function createSkill(token: string, name = "TestSkill"): Promise<string> {
  const res = await request
    .post("/api/skills")
    .set("Authorization", `Bearer ${token}`)
    .set("Content-Type", "application/json")
    .send({ category_id: BODY_CATEGORY_ID, name });

  return (res.body as { id: string }).id;
}

// ---------------------------------------------------------------------------
// POST /api/sessions
// ---------------------------------------------------------------------------

describe("POST /api/sessions", () => {
  it("TC-S004-001: returns 201 with correct xp_earned = floor(duration * difficulty)", async () => {
    const token = await registerLoginAndOnboard(uniqueEmail());
    const skillId = await createSkill(token, "RunningTC001");

    const res = await request
      .post("/api/sessions")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({
        skill_id: skillId,
        duration_minutes: 30,
        difficulty_multiplier: 1.5,
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      session_id: expect.any(String),
      xp_earned: 45,
      new_skill_xp: 45,
      new_total_xp: 45,
    });
  });

  it("TC-S004-002: xp_earned is floored (integer)", async () => {
    const token = await registerLoginAndOnboard(uniqueEmail());
    const skillId = await createSkill(token, "RunningTC002");

    const res = await request
      .post("/api/sessions")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({
        skill_id: skillId,
        duration_minutes: 30,
        difficulty_multiplier: 0.5,
      });

    expect(res.status).toBe(201);
    expect(res.body.xp_earned).toBe(15);
  });

  it("TC-S004-003: second log accumulates xp on the same skill", async () => {
    const token = await registerLoginAndOnboard(uniqueEmail());
    const skillId = await createSkill(token, "RunningTC003");

    await request
      .post("/api/sessions")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ skill_id: skillId, duration_minutes: 20, difficulty_multiplier: 1.0 });

    const res2 = await request
      .post("/api/sessions")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ skill_id: skillId, duration_minutes: 10, difficulty_multiplier: 1.0 });

    expect(res2.status).toBe(201);
    expect(res2.body.new_skill_xp).toBe(30);
    expect(res2.body.new_total_xp).toBe(30);
  });

  it("TC-S004-004: peak_xp is updated on the skill (visible via GET /api/skills)", async () => {
    const token = await registerLoginAndOnboard(uniqueEmail());
    const skillId = await createSkill(token, "PeakXpSkill");

    await request
      .post("/api/sessions")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ skill_id: skillId, duration_minutes: 50, difficulty_multiplier: 2.0 });

    const skillsRes = await request
      .get("/api/skills")
      .set("Authorization", `Bearer ${token}`);

    const allSkills = (skillsRes.body.categories as Array<{ skills: Array<{ id: string; peak_xp: number; current_xp: number }> }>)
      .flatMap((c) => c.skills);
    const skill = allSkills.find((s) => s.id === skillId);

    expect(skill).toBeDefined();
    expect(skill!.current_xp).toBe(100);
    expect(skill!.peak_xp).toBe(100);
  });

  it("TC-S004-005: optional notes field is accepted", async () => {
    const token = await registerLoginAndOnboard(uniqueEmail());
    const skillId = await createSkill(token, "NotesSkill");

    const res = await request
      .post("/api/sessions")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({
        skill_id: skillId,
        duration_minutes: 15,
        difficulty_multiplier: 1.0,
        notes: "Felt good",
      });

    expect(res.status).toBe(201);
    expect(res.body.xp_earned).toBe(15);
  });

  it("TC-S004-006: returns 400 for duration_minutes = 0", async () => {
    const token = await registerLoginAndOnboard(uniqueEmail());
    const skillId = await createSkill(token, "DurationSkill06");

    const res = await request
      .post("/api/sessions")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ skill_id: skillId, duration_minutes: 0, difficulty_multiplier: 1.0 });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "INVALID_DURATION" });
  });

  it("TC-S004-007: returns 400 for duration_minutes > 480", async () => {
    const token = await registerLoginAndOnboard(uniqueEmail());
    const skillId = await createSkill(token, "DurationSkill07");

    const res = await request
      .post("/api/sessions")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ skill_id: skillId, duration_minutes: 481, difficulty_multiplier: 1.0 });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "INVALID_DURATION" });
  });

  it("TC-S004-008: returns 400 for invalid difficulty_multiplier (3.0)", async () => {
    const token = await registerLoginAndOnboard(uniqueEmail());
    const skillId = await createSkill(token, "DiffSkill08");

    const res = await request
      .post("/api/sessions")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ skill_id: skillId, duration_minutes: 30, difficulty_multiplier: 3.0 });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "INVALID_DIFFICULTY" });
  });

  it("TC-S004-009: returns 404 for skill not owned by authenticated user", async () => {
    const token1 = await registerLoginAndOnboard(uniqueEmail());
    const token2 = await registerLoginAndOnboard(uniqueEmail());
    const otherSkillId = await createSkill(token1, "OtherUserSkill09");

    const res = await request
      .post("/api/sessions")
      .set("Authorization", `Bearer ${token2}`)
      .set("Content-Type", "application/json")
      .send({ skill_id: otherSkillId, duration_minutes: 30, difficulty_multiplier: 1.0 });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: "SKILL_NOT_FOUND" });
  });

  it("TC-S004-010: returns 401 without auth header", async () => {
    const res = await request
      .post("/api/sessions")
      .set("Content-Type", "application/json")
      .send({ skill_id: "some-id", duration_minutes: 30, difficulty_multiplier: 1.0 });

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/sessions
// ---------------------------------------------------------------------------

describe("GET /api/sessions", () => {
  it("TC-S004-011: returns 200 with sessions array and total", async () => {
    const token = await registerLoginAndOnboard(uniqueEmail());
    const skillId = await createSkill(token, "GetSessionsSkill");

    await request
      .post("/api/sessions")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ skill_id: skillId, duration_minutes: 30, difficulty_multiplier: 1.0 });

    const res = await request
      .get("/api/sessions")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      sessions: expect.any(Array),
      total: expect.any(Number),
    });
    expect(res.body.sessions.length).toBeGreaterThanOrEqual(1);
  });

  it("TC-S004-012: session entries have the correct shape", async () => {
    const token = await registerLoginAndOnboard(uniqueEmail());
    const skillId = await createSkill(token, "ShapeSkill12");

    await request
      .post("/api/sessions")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ skill_id: skillId, duration_minutes: 45, difficulty_multiplier: 1.5, notes: "Test" });

    const res = await request
      .get("/api/sessions")
      .set("Authorization", `Bearer ${token}`);

    const session = res.body.sessions[0];
    expect(session).toMatchObject({
      id: expect.any(String),
      skill_id: skillId,
      skill_name: "ShapeSkill12",
      duration_minutes: 45,
      difficulty_multiplier: 1.5,
      xp_earned: 67,
      notes: "Test",
      logged_at: expect.any(String),
    });
  });

  it("TC-S004-013: GET ?skill_id= filters to only that skill's sessions", async () => {
    const token = await registerLoginAndOnboard(uniqueEmail());
    const skillA = await createSkill(token, "FilterSkillA13");
    const skillB = await createSkill(token, "FilterSkillB13");

    await request
      .post("/api/sessions")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ skill_id: skillA, duration_minutes: 20, difficulty_multiplier: 1.0 });

    await request
      .post("/api/sessions")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ skill_id: skillB, duration_minutes: 20, difficulty_multiplier: 1.0 });

    const res = await request
      .get(`/api/sessions?skill_id=${skillA}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sessions.every((s: { skill_id: string }) => s.skill_id === skillA)).toBe(true);
  });

  it("TC-S004-014: returns 401 without auth header", async () => {
    const res = await request.get("/api/sessions");
    expect(res.status).toBe(401);
  });
});
