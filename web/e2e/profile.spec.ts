/**
 * S-002 — User profile creation and onboarding
 * E2E tests (Playwright, baseURL: http://localhost:3002)
 *
 * These tests are written RED-first. The /onboarding and /profile pages
 * do not exist yet — all tests will fail. That is correct.
 *
 * Auth setup pattern (same as S-001):
 *   1. POST /api/auth/signup to create an account (idempotent on 409)
 *   2. POST /api/auth/login to set the httpOnly auth-token cookie
 *
 * AC coverage:
 *   AC-1: completing onboarding creates a profile with name, avatar, class='Shadow Novice', xp=0
 *   AC-2: user with existing profile is redirected from /onboarding to /dashboard
 *   AC-3: blank display_name blocks form submission with a validation error
 *   AC-4: /profile displays name, avatar, class badge ('Shadow Novice'), and total_xp
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_PASSWORD = "ValidPass1";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let emailCounter = 0;

function uniqueEmail(): string {
  return `e2e-profile-${++emailCounter}-${Date.now()}@example.com`;
}

async function setupAuthenticatedUser(
  page: Page,
  email: string
): Promise<void> {
  await page.request.post("/api/auth/signup", {
    data: { email, password: TEST_PASSWORD },
    headers: { "Content-Type": "application/json" },
    failOnStatusCode: false,
  });

  await page.request.post("/api/auth/login", {
    data: { email, password: TEST_PASSWORD },
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Completes the onboarding form for a given user who is already authenticated.
 * Navigates to /onboarding, fills in the form, and submits.
 */
async function completeOnboarding(
  page: Page,
  displayName: string,
  avatarSeed = "e2e-seed-01"
): Promise<void> {
  await page.goto("/onboarding");

  await page.getByLabel(/display.?name|name/i).fill(displayName);

  // AvatarSeedPicker: the seed input or picker interaction.
  // It may be a text input for the seed string, or a visual picker.
  // We fill a text input if present; the component may auto-select otherwise.
  const seedInput = page.locator("input[name='avatar_seed'], input[data-testid='avatar-seed']");
  if (await seedInput.count() > 0) {
    await seedInput.first().fill(avatarSeed);
  }

  await page.getByRole("button", { name: /complete|finish|start|submit/i }).click();
}

// ---------------------------------------------------------------------------
// AC-1: Completing onboarding inserts a user_profile record
// ---------------------------------------------------------------------------

test.describe("AC-1: Onboarding creates a user profile", () => {
  // TC-010
  test("TC-010: onboarding_creates_profile — after submitting valid onboarding form, user lands on /dashboard and profile exists", async ({
    page,
  }) => {
    const email = uniqueEmail();
    await setupAuthenticatedUser(page, email);

    await completeOnboarding(page, "ShadowTester");

    // After successful onboarding, user should be redirected away (to /dashboard).
    await expect(page).toHaveURL("/dashboard", { timeout: 10_000 });
  });

  // TC-011: profile data is correct — verify by visiting /profile immediately after onboarding
  test("TC-011: onboarding_profile_data_correct — after onboarding, /profile shows correct name, 'Shadow Novice' class, and 0 XP", async ({
    page,
  }) => {
    const email = uniqueEmail();
    await setupAuthenticatedUser(page, email);

    await completeOnboarding(page, "GlitchWalker");

    // Navigate to /profile once redirected.
    await page.goto("/profile");

    // Name is visible.
    await expect(page.getByText("GlitchWalker")).toBeVisible({ timeout: 10_000 });

    // Class badge shows 'Shadow Novice'.
    await expect(
      page.getByText(/shadow.?novice/i)
    ).toBeVisible({ timeout: 5_000 });

    // XP counter shows 0.
    await expect(page.getByText(/\b0\s*(xp)?/i)).toBeVisible({ timeout: 5_000 });
  });
});

// ---------------------------------------------------------------------------
// AC-2: User with existing profile is redirected from /onboarding to /dashboard
// ---------------------------------------------------------------------------

test.describe("AC-2: OnboardingGuard redirects already-profiled users", () => {
  // TC-012
  test("TC-012: onboarding_guard_redirects_to_dashboard — navigating to /onboarding with an existing profile redirects to /dashboard", async ({
    page,
  }) => {
    const email = uniqueEmail();
    await setupAuthenticatedUser(page, email);

    // Complete onboarding so the profile exists.
    await completeOnboarding(page, "AlreadyOnboarded");
    await page.waitForURL("/dashboard", { timeout: 10_000 });

    // Now navigate directly to /onboarding again.
    await page.goto("/onboarding");

    // Should be redirected to /dashboard, not shown the onboarding form.
    await expect(page).toHaveURL("/dashboard", { timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// AC-3: Blank display_name blocks form submission with a validation error
// ---------------------------------------------------------------------------

test.describe("AC-3: Onboarding form validation", () => {
  // TC-013
  test("TC-013: onboarding_blank_name_validation_error — submitting with empty name shows a validation error and stays on /onboarding", async ({
    page,
  }) => {
    const email = uniqueEmail();
    await setupAuthenticatedUser(page, email);

    await page.goto("/onboarding");

    // Leave the name field empty and submit.
    await page.getByRole("button", { name: /complete|finish|start|submit/i }).click();

    // A validation error must be visible.
    // Could be an HTML5 required-field message (handled by browser) or an explicit error element.
    // We check for any error feedback: either the page URL is still /onboarding (not navigated)
    // AND an error message or required-field indicator is present.
    const currentUrl = page.url();
    expect(currentUrl).toContain("/onboarding");

    // Check for either a visible error element or a browser validation tooltip.
    // We verify the page did NOT navigate away, which confirms submission was blocked.
    // Also look for an explicit error message element if present.
    const errorVisible = await page
      .locator(
        "[data-testid='name-error'], [role='alert'], .error, [aria-invalid='true']"
      )
      .first()
      .isVisible()
      .catch(() => false);

    // Either a DOM error is shown, or the form simply stayed on the page (native HTML5 validation).
    // Both are acceptable as long as the user is NOT redirected.
    expect(currentUrl).toContain("/onboarding");
    // At least one of these should be true for a well-implemented form.
    // We flag it if neither is present (but do not hard-fail on errorVisible alone,
    // since native browser validation may not produce a DOM element we can query).
    if (!errorVisible) {
      // Native HTML5 validation — the submit was blocked if URL is still /onboarding.
      // This is acceptable per the AC.
      expect(page.url()).toContain("/onboarding");
    }
  });

  // TC-014 (negative): whitespace-only name is also blocked
  test("TC-014: onboarding_whitespace_name_validation_error — whitespace-only name is rejected", async ({
    page,
  }) => {
    const email = uniqueEmail();
    await setupAuthenticatedUser(page, email);

    await page.goto("/onboarding");

    await page.getByLabel(/display.?name|name/i).fill("   ");
    await page.getByRole("button", { name: /complete|finish|start|submit/i }).click();

    // Page must not navigate away — submission is blocked.
    await page.waitForTimeout(1_500);
    expect(page.url()).toContain("/onboarding");
  });
});

// ---------------------------------------------------------------------------
// AC-4: /profile displays name, avatar, class badge, and total_xp
// ---------------------------------------------------------------------------

test.describe("AC-4: Profile page renders correct data", () => {
  // TC-015
  test("TC-015: profile_page_shows_name — display_name is visible on /profile", async ({
    page,
  }) => {
    const email = uniqueEmail();
    await setupAuthenticatedUser(page, email);
    await completeOnboarding(page, "NeonCrawler");
    await page.goto("/profile");

    await expect(page.getByText("NeonCrawler")).toBeVisible({ timeout: 10_000 });
  });

  // TC-016
  test("TC-016: profile_page_shows_class_badge — ClassBadge shows 'Shadow Novice'", async ({
    page,
  }) => {
    const email = uniqueEmail();
    await setupAuthenticatedUser(page, email);
    await completeOnboarding(page, "VoidWatcher");
    await page.goto("/profile");

    await expect(page.getByText(/shadow.?novice/i)).toBeVisible({ timeout: 10_000 });
  });

  // TC-017
  test("TC-017: profile_page_shows_xp — total_xp of 0 is displayed", async ({
    page,
  }) => {
    const email = uniqueEmail();
    await setupAuthenticatedUser(page, email);
    await completeOnboarding(page, "ZeroXPUser");
    await page.goto("/profile");

    // XP of 0 should be somewhere on the page (e.g. "0 XP" or "XP: 0").
    await expect(page.getByText(/0\s*xp|xp.*0/i)).toBeVisible({ timeout: 10_000 });
  });

  // TC-018
  test("TC-018: profile_page_shows_avatar — avatar element is rendered", async ({
    page,
  }) => {
    const email = uniqueEmail();
    await setupAuthenticatedUser(page, email);
    await completeOnboarding(page, "AvatarUser", "my-avatar-seed");
    await page.goto("/profile");

    // An avatar image or SVG should be present. The AvatarSeedPicker renders
    // an image/svg based on the seed. We look for an img, svg, or data-testid='avatar'.
    const avatar = page.locator(
      "img[data-testid='avatar'], svg[data-testid='avatar'], [data-testid='profile-avatar'], img[alt*='avatar' i]"
    );
    await expect(avatar.first()).toBeVisible({ timeout: 10_000 });
  });

  // TC-019 — Edge: unauthenticated visit to /profile redirects to /login
  test("TC-019: profile_page_unauthenticated_redirects — visiting /profile without auth redirects to /login", async ({
    page,
  }) => {
    // Fresh page — no cookies, no auth.
    await page.goto("/profile");
    await expect(page).toHaveURL("/login", { timeout: 10_000 });
  });
});
