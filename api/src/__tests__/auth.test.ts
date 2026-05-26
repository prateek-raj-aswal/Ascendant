/**
 * S-001 — Supabase Auth: sign-up, login, and session management
 * API contract tests (Vitest + supertest)
 *
 * These tests are written RED-first. No implementation exists yet.
 * They will fail until the Fastify app is implemented.
 *
 * The tests import the Fastify app instance and pass it directly to
 * supertest — no port binding required.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";

// This import will fail until the app is implemented — that is intentional.
// The app must export a Fastify instance (not a started server).
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
// POST /api/auth/signup
// ---------------------------------------------------------------------------

describe("POST /api/auth/signup", () => {
  // TC-001 — AC maps to contract: success_response 201
  it("TC-001: signup_valid_201 — valid email + password returns 201 with user_id and email", async () => {
    const res = await request
      .post("/api/auth/signup")
      .send({ email: "newuser@example.com", password: "ValidPass1" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      user_id: expect.any(String),
      email: "newuser@example.com",
    });
    // user_id must look like a UUID
    expect(res.body.user_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  // TC-002 — AC maps to contract: error_response 409
  it("TC-002: signup_duplicate_409 — duplicate email returns 409", async () => {
    // Register once successfully, then attempt to register again with the same email.
    const email = "duplicate@example.com";
    await request
      .post("/api/auth/signup")
      .send({ email, password: "ValidPass1" })
      .set("Content-Type", "application/json");

    const res = await request
      .post("/api/auth/signup")
      .send({ email, password: "ValidPass1" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: "Email already registered" });
  });

  // TC-003 — AC maps to contract: error_response 422 (invalid email)
  it("TC-003: signup_invalid_email_422 — malformed email returns 422 with field=email", async () => {
    const res = await request
      .post("/api/auth/signup")
      .send({ email: "not-an-email", password: "ValidPass1" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      error: expect.any(String),
      field: "email",
    });
  });

  // TC-004 — AC maps to contract: error_response 422 (password too short)
  it("TC-004: signup_short_password_422 — password shorter than 8 chars returns 422 with field=password", async () => {
    const res = await request
      .post("/api/auth/signup")
      .send({ email: "shortpass@example.com", password: "abc" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      error: expect.any(String),
      field: "password",
    });
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

describe("POST /api/auth/login", () => {
  // TC-005 — AC-1 + contract: success_response 200
  it("TC-005: login_valid_200 — valid credentials return 200 with access_token, expires_at, user_id", async () => {
    // Pre-condition: register the user first so the account exists.
    const email = "logintest@example.com";
    const password = "ValidPass1";
    await request
      .post("/api/auth/signup")
      .send({ email, password })
      .set("Content-Type", "application/json");

    const res = await request
      .post("/api/auth/login")
      .send({ email, password })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      access_token: expect.any(String),
      expires_at: expect.any(Number),
      user_id: expect.any(String),
    });
    expect(res.body.access_token.length).toBeGreaterThan(0);
  });

  // TC-006 — AC-2 (API side) + contract: error_response 401
  it("TC-006: login_wrong_password_401 — wrong password returns 401", async () => {
    // Ensure the user exists.
    const email = "wrongpass@example.com";
    await request
      .post("/api/auth/signup")
      .send({ email, password: "CorrectPass1" })
      .set("Content-Type", "application/json");

    const res = await request
      .post("/api/auth/login")
      .send({ email, password: "WrongPass999" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "Invalid email or password" });
  });

  // TC-007 — contract: error_response 422 (missing fields)
  it("TC-007: login_missing_fields_422 — missing email and password returns 422", async () => {
    const res = await request
      .post("/api/auth/login")
      .send({})
      .set("Content-Type", "application/json");

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: "email and password are required" });
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------

describe("POST /api/auth/logout", () => {
  // TC-008 — AC-4 (API side) + contract: success_response 204
  it("TC-008: logout_valid_204 — valid bearer token returns 204", async () => {
    // Register and login to get an access_token.
    const email = "logout@example.com";
    const password = "ValidPass1";
    await request
      .post("/api/auth/signup")
      .send({ email, password })
      .set("Content-Type", "application/json");

    const loginRes = await request
      .post("/api/auth/login")
      .send({ email, password })
      .set("Content-Type", "application/json");

    const { access_token } = loginRes.body as { access_token: string };

    const res = await request
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${access_token}`);

    expect(res.status).toBe(204);
  });

  // TC-009 — contract: error_response 401 (no token)
  it("TC-009: logout_no_token_401 — missing Authorization header returns 401", async () => {
    const res = await request.post("/api/auth/logout");

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "Unauthorized" });
  });
});
