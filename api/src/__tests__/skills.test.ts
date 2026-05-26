/**
 * S-003 — Skill tree: view and manage sub-skills under the four system categories
 * API contract tests (Vitest + supertest)
 *
 * These tests are written RED-first. No skills routes/service exist yet.
 * Every test in this file will fail until the implementation is in place.
 *
 * Auth pattern:
 *   - POST /api/auth/signup to create an account
 *   - POST /api/auth/login to obtain an access_token
 *   - Pass Authorization: Bearer <access_token> on skills requests
 *
 * Contract coverage:
 *   GET    /api/skills           — 200 shape, 401 no auth
 *   POST   /api/skills           — 201 create, 401, 404 cat, 409 dup, 422 missing name
 *   PUT    /api/skills/:id       — 200 update, 401, 404, 409 dup, 422 no fields
 *   DELETE /api/skills/:id       — 204 clean, 400 has history+no force, 204 force, 401, 404
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";

// This import will fail (red) until skill routes are registered in app.ts.
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

function uniqueEmail(): string {
  return `skills-test-${++emailCounter}-${Date.now()}@example.com`;
}

/**
 * Registers a user, logs in, and returns a Bearer token.
 * Depends on S-001 auth routes already being registered on the same app.
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
// GET /api/skills
// ---------------------------------------------------------------------------

describe("GET /api/skills", () => {
  // TC-001 — 401 when no Authorization header
  it("TC-001: get_skills_no_auth_401 — missing Authorization header returns 401", async () => {
    const res = await request.get("/api/skills");

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "Unauthorized" });
  });

  // TC-002 — 200 with correct shape; four seeded categories returned
  it("TC-002: get_skills_200 — returns 200 with categories array containing four system categories", async () => {
    const token = await registerAndLogin(uniqueEmail());

    const res = await request
      .get("/api/skills")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("categories");
    expect(Array.isArray(res.body.categories)).toBe(true);
    expect(res.body.categories).toHaveLength(4);

    // Each category must have the required fields.
    for (const cat of res.body.categories) {
      expect(cat).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        display_order: expect.any(Number),
        skills: expect.any(Array),
      });
    }

    // The four system categories must be present in display_order order.
    const names = res.body.categories.map((c: { name: string }) => c.name);
    expect(names).toContain("Body");
    expect(names).toContain("Mind");
    expect(names).toContain("Craft");
    expect(names).toContain("Spirit");

    // display_order must be 1–4 and in order.
    const orders = res.body.categories.map((c: { display_order: number }) => c.display_order);
    expect(orders).toEqual([1, 2, 3, 4]);
  });

  // TC-003 — skills array shape when a skill exists
  it("TC-003: get_skills_skill_shape — skills array entries have the correct field shape", async () => {
    const token = await registerAndLogin(uniqueEmail());

    // First create a skill so the skills array is non-empty.
    const catRes = await request
      .get("/api/skills")
      .set("Authorization", `Bearer ${token}`);
    const categoryId = catRes.body.categories[0].id as string;

    await request
      .post("/api/skills")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ category_id: categoryId, name: "ShapeCheckSkill" });

    const res = await request
      .get("/api/skills")
      .set("Authorization", `Bearer ${token}`);

    const bodyCategory = res.body.categories.find(
      (c: { id: string }) => c.id === categoryId
    );
    expect(bodyCategory.skills).toHaveLength(1);
    expect(bodyCategory.skills[0]).toMatchObject({
      id: expect.any(String),
      name: "ShapeCheckSkill",
      current_xp: 0,
      peak_xp: 0,
    });
    // description and last_session_at may be null
    expect(
      bodyCategory.skills[0].description === null ||
        typeof bodyCategory.skills[0].description === "string"
    ).toBe(true);
    expect(
      bodyCategory.skills[0].last_session_at === null ||
        typeof bodyCategory.skills[0].last_session_at === "string"
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// POST /api/skills
// ---------------------------------------------------------------------------

describe("POST /api/skills", () => {
  // TC-004 — 401 when no auth
  it("TC-004: post_skills_no_auth_401 — missing Authorization header returns 401", async () => {
    const res = await request
      .post("/api/skills")
      .set("Content-Type", "application/json")
      .send({ category_id: "00000000-0000-0000-0000-000000000001", name: "Ghost" });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "Unauthorized" });
  });

  // TC-005 — 201 happy path: skill created with xp=0
  it("TC-005: post_skills_201 — valid request creates skill with current_xp=0 and peak_xp=0", async () => {
    const token = await registerAndLogin(uniqueEmail());

    // Fetch category id from the seeded categories.
    const catRes = await request
      .get("/api/skills")
      .set("Authorization", `Bearer ${token}`);
    const category = catRes.body.categories.find((c: { name: string }) => c.name === "Body");
    const categoryId = category.id as string;

    const res = await request
      .post("/api/skills")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ category_id: categoryId, name: "Push-ups", description: "Daily push-up practice" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(String),
      category_id: categoryId,
      name: "Push-ups",
      description: "Daily push-up practice",
      current_xp: 0,
      peak_xp: 0,
    });
    expect(res.body.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  // TC-006 — 201 without optional description
  it("TC-006: post_skills_no_description_201 — description is optional; null when omitted", async () => {
    const token = await registerAndLogin(uniqueEmail());

    const catRes = await request
      .get("/api/skills")
      .set("Authorization", `Bearer ${token}`);
    const categoryId = catRes.body.categories[0].id as string;

    const res = await request
      .post("/api/skills")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ category_id: categoryId, name: "NoDescript" });

    expect(res.status).toBe(201);
    expect(res.body.description).toBeNull();
  });

  // TC-007 — 422 name missing
  it("TC-007: post_skills_missing_name_422 — omitting name returns 422 with field=name", async () => {
    const token = await registerAndLogin(uniqueEmail());

    const catRes = await request
      .get("/api/skills")
      .set("Authorization", `Bearer ${token}`);
    const categoryId = catRes.body.categories[0].id as string;

    const res = await request
      .post("/api/skills")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ category_id: categoryId });

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: "name is required", field: "name" });
  });

  // TC-008 — 404 category not found
  it("TC-008: post_skills_unknown_category_404 — non-existent category_id returns 404", async () => {
    const token = await registerAndLogin(uniqueEmail());

    const res = await request
      .post("/api/skills")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({
        category_id: "00000000-0000-0000-0000-000000000000",
        name: "Phantom Skill",
      });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: "Category not found" });
  });

  // TC-009 — 409 duplicate skill name in same category for same user
  it("TC-009: post_skills_duplicate_409 — same skill name in same category returns 409", async () => {
    const token = await registerAndLogin(uniqueEmail());

    const catRes = await request
      .get("/api/skills")
      .set("Authorization", `Bearer ${token}`);
    const categoryId = catRes.body.categories[0].id as string;

    await request
      .post("/api/skills")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ category_id: categoryId, name: "DuplicateSkill" });

    const res = await request
      .post("/api/skills")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ category_id: categoryId, name: "DuplicateSkill" });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      error: "Skill name already exists under this category",
    });
  });

  // TC-010 — same name in same category is allowed for a DIFFERENT user (scope check)
  it("TC-010: post_skills_different_user_same_name_201 — same name in same category for a different user is allowed", async () => {
    const token1 = await registerAndLogin(uniqueEmail());
    const token2 = await registerAndLogin(uniqueEmail());

    const catRes = await request
      .get("/api/skills")
      .set("Authorization", `Bearer ${token1}`);
    const categoryId = catRes.body.categories[0].id as string;

    await request
      .post("/api/skills")
      .set("Authorization", `Bearer ${token1}`)
      .set("Content-Type", "application/json")
      .send({ category_id: categoryId, name: "SharedNameSkill" });

    // Different user — should succeed.
    const res = await request
      .post("/api/skills")
      .set("Authorization", `Bearer ${token2}`)
      .set("Content-Type", "application/json")
      .send({ category_id: categoryId, name: "SharedNameSkill" });

    expect(res.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/skills/:id
// ---------------------------------------------------------------------------

describe("PUT /api/skills/:id", () => {
  // TC-011 — 401 when no auth
  it("TC-011: put_skill_no_auth_401 — missing Authorization header returns 401", async () => {
    const res = await request
      .put("/api/skills/00000000-0000-0000-0000-000000000001")
      .set("Content-Type", "application/json")
      .send({ name: "Updated" });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "Unauthorized" });
  });

  // TC-012 — 200 name updated
  it("TC-012: put_skill_200 — valid name update returns 200 with updated name", async () => {
    const token = await registerAndLogin(uniqueEmail());

    const catRes = await request
      .get("/api/skills")
      .set("Authorization", `Bearer ${token}`);
    const categoryId = catRes.body.categories[0].id as string;

    const createRes = await request
      .post("/api/skills")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ category_id: categoryId, name: "OldName" });

    const skillId = createRes.body.id as string;

    const res = await request
      .put(`/api/skills/${skillId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ name: "NewName" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: skillId, name: "NewName" });
  });

  // TC-013 — 200 description updated
  it("TC-013: put_skill_description_200 — valid description update returns 200 with updated description", async () => {
    const token = await registerAndLogin(uniqueEmail());

    const catRes = await request
      .get("/api/skills")
      .set("Authorization", `Bearer ${token}`);
    const categoryId = catRes.body.categories[0].id as string;

    const createRes = await request
      .post("/api/skills")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ category_id: categoryId, name: "SkillForDescUpdate" });

    const skillId = createRes.body.id as string;

    const res = await request
      .put(`/api/skills/${skillId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ description: "Updated description text" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: skillId,
      description: "Updated description text",
    });
  });

  // TC-014 — 404 skill not found
  it("TC-014: put_skill_not_found_404 — unknown skill id returns 404", async () => {
    const token = await registerAndLogin(uniqueEmail());

    const res = await request
      .put("/api/skills/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ name: "Irrelevant" });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: "Skill not found" });
  });

  // TC-015 — 409 name taken in same category
  it("TC-015: put_skill_name_taken_409 — renaming to a name already used in category returns 409", async () => {
    const token = await registerAndLogin(uniqueEmail());

    const catRes = await request
      .get("/api/skills")
      .set("Authorization", `Bearer ${token}`);
    const categoryId = catRes.body.categories[0].id as string;

    // Create two skills.
    await request
      .post("/api/skills")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ category_id: categoryId, name: "ExistingName" });

    const createRes = await request
      .post("/api/skills")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ category_id: categoryId, name: "SkillToRename" });

    const skillId = createRes.body.id as string;

    // Try to rename to an already-taken name.
    const res = await request
      .put(`/api/skills/${skillId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ name: "ExistingName" });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      error: "Skill name already exists under this category",
    });
  });

  // TC-016 — 422 no fields provided
  it("TC-016: put_skill_no_fields_422 — empty body returns 422", async () => {
    const token = await registerAndLogin(uniqueEmail());

    const catRes = await request
      .get("/api/skills")
      .set("Authorization", `Bearer ${token}`);
    const categoryId = catRes.body.categories[0].id as string;

    const createRes = await request
      .post("/api/skills")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ category_id: categoryId, name: "EmptyUpdateSkill" });

    const skillId = createRes.body.id as string;

    const res = await request
      .put(`/api/skills/${skillId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({});

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: "No updatable fields provided" });
  });

  // TC-017 — user cannot update another user's skill
  it("TC-017: put_skill_other_user_404 — updating another user's skill returns 404", async () => {
    const token1 = await registerAndLogin(uniqueEmail());
    const token2 = await registerAndLogin(uniqueEmail());

    const catRes = await request
      .get("/api/skills")
      .set("Authorization", `Bearer ${token1}`);
    const categoryId = catRes.body.categories[0].id as string;

    const createRes = await request
      .post("/api/skills")
      .set("Authorization", `Bearer ${token1}`)
      .set("Content-Type", "application/json")
      .send({ category_id: categoryId, name: "User1Skill" });

    const skillId = createRes.body.id as string;

    // token2 tries to update token1's skill.
    const res = await request
      .put(`/api/skills/${skillId}`)
      .set("Authorization", `Bearer ${token2}`)
      .set("Content-Type", "application/json")
      .send({ name: "Hijacked" });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: "Skill not found" });
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/skills/:id
// ---------------------------------------------------------------------------

describe("DELETE /api/skills/:id", () => {
  // TC-018 — 401 when no auth
  it("TC-018: delete_skill_no_auth_401 — missing Authorization header returns 401", async () => {
    const res = await request.delete(
      "/api/skills/00000000-0000-0000-0000-000000000001"
    );

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "Unauthorized" });
  });

  // TC-019 — 204 for skill with no session history
  it("TC-019: delete_skill_204 — deleting a skill with no session history returns 204", async () => {
    const token = await registerAndLogin(uniqueEmail());

    const catRes = await request
      .get("/api/skills")
      .set("Authorization", `Bearer ${token}`);
    const categoryId = catRes.body.categories[0].id as string;

    const createRes = await request
      .post("/api/skills")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ category_id: categoryId, name: "ToDeleteClean" });

    const skillId = createRes.body.id as string;

    const res = await request
      .delete(`/api/skills/${skillId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(204);
  });

  // TC-020 — 404 skill not found
  it("TC-020: delete_skill_not_found_404 — unknown skill id returns 404", async () => {
    const token = await registerAndLogin(uniqueEmail());

    const res = await request
      .delete("/api/skills/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: "Skill not found" });
  });

  // TC-021 — 400 when skill has session history and force not set
  it("TC-021: delete_skill_has_history_400 — skill with session history returns 400 without force=true", async () => {
    const token = await registerAndLogin(uniqueEmail());

    const catRes = await request
      .get("/api/skills")
      .set("Authorization", `Bearer ${token}`);
    const categoryId = catRes.body.categories[0].id as string;

    // Create skill, then simulate session history by seeding the service.
    // The test relies on an internal mechanism exposed by the service to inject history.
    // We trigger via the route-level mechanism: a future /api/sessions POST (not yet in scope)
    // or the service's in-memory seeding. For now we verify the route honours the flag by
    // relying on the InMemorySkillService to support seeding history (which the implementation
    // must expose as a testing surface). The test will be red until the service honours it.
    const createRes = await request
      .post("/api/skills")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ category_id: categoryId, name: "SkillWithHistory" });

    const skillId = createRes.body.id as string;

    // Seed session history via the test-only seeding endpoint.
    // The implementation must register POST /api/skills/:id/test-seed-history
    // (only available in test/dev, not production).
    await request
      .post(`/api/skills/${skillId}/test-seed-history`)
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({});

    const res = await request
      .delete(`/api/skills/${skillId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: "Skill has session history. Pass force=true to confirm deletion.",
    });
  });

  // TC-022 — 204 when skill has session history and force=true
  it("TC-022: delete_skill_force_204 — skill with session history deleted successfully with force=true", async () => {
    const token = await registerAndLogin(uniqueEmail());

    const catRes = await request
      .get("/api/skills")
      .set("Authorization", `Bearer ${token}`);
    const categoryId = catRes.body.categories[0].id as string;

    const createRes = await request
      .post("/api/skills")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ category_id: categoryId, name: "ForceDeleteSkill" });

    const skillId = createRes.body.id as string;

    // Seed session history.
    await request
      .post(`/api/skills/${skillId}/test-seed-history`)
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({});

    const res = await request
      .delete(`/api/skills/${skillId}?force=true`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(204);
  });

  // TC-023 — skill removed from GET /api/skills after delete
  it("TC-023: delete_skill_removed_from_list — deleted skill no longer appears in GET /api/skills", async () => {
    const token = await registerAndLogin(uniqueEmail());

    const catRes = await request
      .get("/api/skills")
      .set("Authorization", `Bearer ${token}`);
    const categoryId = catRes.body.categories[0].id as string;

    const createRes = await request
      .post("/api/skills")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ category_id: categoryId, name: "WillBeDeleted" });

    const skillId = createRes.body.id as string;

    await request
      .delete(`/api/skills/${skillId}`)
      .set("Authorization", `Bearer ${token}`);

    const afterRes = await request
      .get("/api/skills")
      .set("Authorization", `Bearer ${token}`);

    const targetCat = afterRes.body.categories.find(
      (c: { id: string }) => c.id === categoryId
    );
    const stillPresent = targetCat.skills.some(
      (s: { id: string }) => s.id === skillId
    );
    expect(stillPresent).toBe(false);
  });
});
