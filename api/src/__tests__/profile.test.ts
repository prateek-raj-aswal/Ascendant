/**
 * S-002 — User profile creation and onboarding
 * API contract tests (Vitest + supertest)
 *
 * These tests are written RED-first. The profile routes do not exist yet.
 * Every test in this file will fail until the implementation is in place.
 *
 * Auth pattern:
 *   - POST /api/auth/signup to create an account
 *   - POST /api/auth/login to obtain an access_token
 *   - Pass Authorization: Bearer <access_token> on profile requests
 *
 * AC coverage:
 *   AC-1: POST /api/profile/onboard — happy path returns 201 with correct shape
 *   AC-1: POST /api/profile/onboard — class defaults to "shadow_novice", total_xp=0
 *   AC-1: POST /api/profile/onboard — 409 when profile already exists
 *   AC-3: POST /api/profile/onboard — 422 when display_name is blank/missing
 *   AC-4: GET  /api/profile — returns full profile shape
 *   Edge: POST /api/profile/onboard — 401 when no auth token supplied
 *   Edge: GET  /api/profile — 401 when no auth token supplied
 *   Edge: GET  /api/profile — 404 when authenticated but no profile yet
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import supertest from "supertest";

// This import will fail (red) until profile routes are registered in app.ts.
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

let emailCounter = 0;

/** Create a unique email so each test starts with a fresh account. */
function uniqueEmail(): string {
  return `profile-test-${++emailCounter}-${Date.now()}@example.com`;
}

/**
 * Registers a new user and returns a Bearer token.
 * Relies on the S-001 auth routes already being registered on the same app.
 */
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

// ---------------------------------------------------------------------------
// POST /api/profile/onboard
// ---------------------------------------------------------------------------

describe("POST /api/profile/onboard", () => {
  // TC-001 — AC-1: happy path returns 201 with correct response shape
  it("TC-001: onboard_happy_path_201 — valid request returns 201 with id, display_name, avatar_seed, class, total_xp", async () => {
    const token = await registerAndLogin(uniqueEmail());

    const res = await request
      .post("/api/profile/onboard")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ display_name: "Shadow Tester", avatar_seed: "seed-abc123" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(String),
      display_name: "Shadow Tester",
      avatar_seed: "seed-abc123",
      class: "shadow_novice",
      total_xp: 0,
    });
    // id must be a UUID
    expect(res.body.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  // TC-002 — AC-1: class is always "shadow_novice" and total_xp is always 0 on creation
  it("TC-002: onboard_defaults_shadow_novice — class is 'shadow_novice' and total_xp is 0 regardless of request body", async () => {
    const token = await registerAndLogin(uniqueEmail());

    const res = await request
      .post("/api/profile/onboard")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ display_name: "AnotherUser", avatar_seed: "seed-xyz" });

    expect(res.status).toBe(201);
    expect(res.body.class).toBe("shadow_novice");
    expect(res.body.total_xp).toBe(0);
  });

  // TC-003 — AC-1: 409 when same user attempts to create a second profile
  it("TC-003: onboard_duplicate_409 — second onboard call for same user returns 409", async () => {
    const token = await registerAndLogin(uniqueEmail());

    // First call succeeds.
    await request
      .post("/api/profile/onboard")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ display_name: "FirstProfile", avatar_seed: "seed-first" });

    // Second call must fail.
    const res = await request
      .post("/api/profile/onboard")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ display_name: "SecondProfile", avatar_seed: "seed-second" });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: "Profile already exists for this user" });
  });

  // TC-004 — AC-3: 422 when display_name is missing
  it("TC-004: onboard_missing_display_name_422 — omitting display_name returns 422 with field=display_name", async () => {
    const token = await registerAndLogin(uniqueEmail());

    const res = await request
      .post("/api/profile/onboard")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ avatar_seed: "seed-noname" });

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      error: "display_name is required",
      field: "display_name",
    });
  });

  // TC-005 — AC-3: 422 when display_name is an empty string
  it("TC-005: onboard_blank_display_name_422 — empty string display_name returns 422 with field=display_name", async () => {
    const token = await registerAndLogin(uniqueEmail());

    const res = await request
      .post("/api/profile/onboard")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ display_name: "", avatar_seed: "seed-blank" });

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      error: "display_name is required",
      field: "display_name",
    });
  });

  // TC-006 — Edge: 401 when no Authorization header is provided
  it("TC-006: onboard_no_auth_401 — missing Authorization header returns 401", async () => {
    const res = await request
      .post("/api/profile/onboard")
      .set("Content-Type", "application/json")
      .send({ display_name: "Ghost", avatar_seed: "seed-ghost" });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "Unauthorized" });
  });
});

// ---------------------------------------------------------------------------
// GET /api/profile
// ---------------------------------------------------------------------------

describe("GET /api/profile", () => {
  // TC-007 — AC-4: returns full profile shape after onboarding
  it("TC-007: get_profile_200 — returns full profile object for a user who has completed onboarding", async () => {
    const token = await registerAndLogin(uniqueEmail());

    // Create the profile first.
    await request
      .post("/api/profile/onboard")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ display_name: "GetProfileUser", avatar_seed: "seed-getprofile" });

    const res = await request
      .get("/api/profile")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: expect.any(String),
      display_name: "GetProfileUser",
      avatar_seed: "seed-getprofile",
      class: "shadow_novice",
      total_xp: 0,
      burnout_active: expect.any(Boolean),
      current_streak: expect.any(Number),
      longest_streak: expect.any(Number),
      subscription_tier: expect.any(String),
      ai_calls_this_month: expect.any(Number),
      ai_quota_limit: expect.any(Number),
    });
    // burnout_started_at may be null or a string
    expect(
      res.body.burnout_started_at === null || typeof res.body.burnout_started_at === "string"
    ).toBe(true);
  });

  // TC-008 — Edge: 401 when no auth token
  it("TC-008: get_profile_no_auth_401 — missing Authorization header returns 401", async () => {
    const res = await request.get("/api/profile");

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "Unauthorized" });
  });

  // TC-009 — Edge: 404 when authenticated user has not yet onboarded
  it("TC-009: get_profile_not_found_404 — authenticated user with no profile returns 404", async () => {
    const token = await registerAndLogin(uniqueEmail());

    // Do NOT call onboard — the user has no profile.
    const res = await request
      .get("/api/profile")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: "Profile not found" });
  });
});
