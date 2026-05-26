/**
 * S-001 — Supabase Auth: sign-up, login, and session management
 * E2E tests (Playwright)
 *
 * These tests are written RED-first against http://localhost:3000.
 * No Next.js implementation exists yet — all tests will fail. That is correct.
 *
 * AC coverage:
 *   AC-1: valid login → redirect to /dashboard + session cookie
 *   AC-2: invalid login → inline error, no redirect
 *   AC-3: unauthenticated /dashboard → redirect to /login
 *   AC-4: logout → session destroyed, redirect to /login
 *   AC-5: session persistence on page refresh
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_EMAIL = "e2e-auth@example.com";
const TEST_PASSWORD = "ValidPass1";

/**
 * Registers a new user via the API directly so E2E tests have a known account.
 * Idempotent — ignores 409 (already registered).
 */
async function ensureUserExists(page: Page): Promise<void> {
  await page.request.post("/api/auth/signup", {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  // 201 on first call, 409 on subsequent — both are acceptable preconditions.
}

/**
 * Logs in via the UI login form and waits for navigation to /dashboard.
 */
async function loginViaUI(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(TEST_EMAIL);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await page.waitForURL("/dashboard", { timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// AC-1: valid credentials → redirect to /dashboard + session cookie set
// ---------------------------------------------------------------------------

test.describe("AC-1: Login with valid credentials", () => {
  // TC-010
  test("TC-010: login_valid_credentials_redirects_to_dashboard — submitting correct email+password lands on /dashboard", async ({
    page,
  }) => {
    await ensureUserExists(page);
    await page.goto("/login");

    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /log in|sign in/i }).click();

    await expect(page).toHaveURL("/dashboard", { timeout: 10_000 });
  });

  // TC-011 (edge case: session cookie is actually present after login)
  test("TC-011: login_sets_session_cookie — a Supabase session cookie is present after successful login", async ({
    page,
    context,
  }) => {
    await ensureUserExists(page);
    await loginViaUI(page);

    const cookies = await context.cookies();
    // Supabase sets a cookie whose name contains "auth-token" or "sb-" prefix.
    const sessionCookie = cookies.find(
      (c) => c.name.includes("sb-") || c.name.includes("auth-token")
    );
    expect(sessionCookie).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC-2: invalid credentials → inline error, no redirect
// ---------------------------------------------------------------------------

test.describe("AC-2: Login with invalid credentials", () => {
  // TC-012
  test("TC-012: login_invalid_credentials_shows_error — wrong password shows inline error message", async ({
    page,
  }) => {
    await ensureUserExists(page);
    await page.goto("/login");

    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill("WrongPassword999");
    await page.getByRole("button", { name: /log in|sign in/i }).click();

    // An error message must be visible on the page.
    const errorMessage = page.getByRole("alert").or(page.locator("[data-testid='auth-error']"));
    await expect(errorMessage).toBeVisible({ timeout: 5_000 });

    // Must NOT have navigated away from /login.
    expect(page.url()).toContain("/login");
  });

  // TC-013 (negative: page URL unchanged after failed login)
  test("TC-013: login_invalid_no_redirect — URL remains /login after failed authentication", async ({
    page,
  }) => {
    await ensureUserExists(page);
    await page.goto("/login");

    await page.getByLabel(/email/i).fill("nosuchuser@example.com");
    await page.getByLabel(/password/i).fill("SomePassword1");
    await page.getByRole("button", { name: /log in|sign in/i }).click();

    // Wait briefly to confirm no navigation occurs.
    await page.waitForTimeout(2_000);
    expect(page.url()).toContain("/login");
  });
});

// ---------------------------------------------------------------------------
// AC-3: unauthenticated access to /dashboard → redirect to /login
// ---------------------------------------------------------------------------

test.describe("AC-3: Unauthenticated /dashboard redirect", () => {
  // TC-014
  test("TC-014: unauthenticated_dashboard_redirects_to_login — navigating to /dashboard without a session lands on /login", async ({
    page,
  }) => {
    // Fresh context — no cookies, no session.
    await page.goto("/dashboard");
    await expect(page).toHaveURL("/login", { timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// AC-4: logout destroys session and redirects to /login
// ---------------------------------------------------------------------------

test.describe("AC-4: Logout destroys session", () => {
  // TC-015
  test("TC-015: logout_destroys_session_redirects_to_login — clicking Log Out lands on /login", async ({
    page,
  }) => {
    await ensureUserExists(page);
    await loginViaUI(page);

    // Click the log out button (exact label may vary; use flexible matcher).
    await page.getByRole("button", { name: /log out|sign out/i }).click();

    await expect(page).toHaveURL("/login", { timeout: 10_000 });
  });

  // TC-016 (edge case: after logout, /dashboard is no longer accessible)
  test("TC-016: logout_then_dashboard_redirects_to_login — after logout, navigating to /dashboard redirects to /login", async ({
    page,
  }) => {
    await ensureUserExists(page);
    await loginViaUI(page);

    await page.getByRole("button", { name: /log out|sign out/i }).click();
    await page.waitForURL("/login", { timeout: 10_000 });

    await page.goto("/dashboard");
    await expect(page).toHaveURL("/login", { timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// AC-5: session persists on page refresh
// ---------------------------------------------------------------------------

test.describe("AC-5: Session persistence on refresh", () => {
  // TC-017
  test("TC-017: session_persists_on_refresh — authenticated user stays on /dashboard after full page reload", async ({
    page,
  }) => {
    await ensureUserExists(page);
    await loginViaUI(page);

    // Hard reload.
    await page.reload();

    // Must still be on /dashboard, not redirected to /login.
    await expect(page).toHaveURL("/dashboard", { timeout: 10_000 });
  });
});
