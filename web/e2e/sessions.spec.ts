/**
 * S-004 — Log a training session
 * E2E tests (Playwright, baseURL: http://localhost:3002)
 *
 * Auth + profile setup pattern (required before /skills is accessible).
 * A skill is created via the skills UI before each test.
 */

import { test, expect, type Page } from "@playwright/test";

const TEST_PASSWORD = "ValidPass1";

let emailCounter = 0;

function uniqueEmail(): string {
  return `e2e-sessions-${++emailCounter}-${Date.now()}@example.com`;
}

async function setupReadyUser(page: Page, email: string): Promise<void> {
  await page.request.post("/api/auth/signup", {
    data: { email, password: TEST_PASSWORD },
    headers: { "Content-Type": "application/json" },
    failOnStatusCode: false,
  });

  await page.request.post("/api/auth/login", {
    data: { email, password: TEST_PASSWORD },
    headers: { "Content-Type": "application/json" },
  });

  await page.request.post("/api/profile/onboard", {
    data: { display_name: "SessionsTestUser", avatar_seed: "seed-sessions-e2e" },
    headers: { "Content-Type": "application/json" },
    failOnStatusCode: false,
  });
}

async function createSkillAndGetId(page: Page): Promise<string> {
  const res = await page.request.post("/api/skills", {
    data: {
      category_id: "00000000-0000-0000-0000-000000000001",
      name: `RunningE2E-${Date.now()}`,
    },
    headers: { "Content-Type": "application/json" },
  });
  const body = await res.json() as { id: string };
  return body.id;
}

// ---------------------------------------------------------------------------
// TC-S004-E01: Log Session button visible on skill row
// ---------------------------------------------------------------------------

test.describe("TC-S004-E01: Log Session button visible on skill row", () => {
  test("each skill row shows a Log Session button", async ({ page }) => {
    const email = uniqueEmail();
    await setupReadyUser(page, email);
    await createSkillAndGetId(page);

    await page.goto("/skills");

    // Expand Body category
    const bodyHeader = page.locator("button").filter({ hasText: "Body" }).first();
    await bodyHeader.click();

    // Expect a "Log Session" button to be visible
    await expect(
      page.getByRole("button", { name: /log session/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// TC-S004-E02: LogSessionModal opens, fills, and submits
// ---------------------------------------------------------------------------

test.describe("TC-S004-E02: LogSessionModal opens and submits", () => {
  test("modal opens on button click, submits, and shows XP toast", async ({ page }) => {
    const email = uniqueEmail();
    await setupReadyUser(page, email);
    await createSkillAndGetId(page);

    await page.goto("/skills");

    // Expand Body category
    const bodyHeader = page.locator("button").filter({ hasText: "Body" }).first();
    await bodyHeader.click();

    // Click "Log Session" on the first skill row
    await page.getByRole("button", { name: /log session/i }).first().click();

    // Modal should be visible
    await expect(page.locator("[role='dialog']")).toBeVisible({ timeout: 5_000 });

    // Fill duration
    await page.locator("[role='dialog']").getByLabel(/duration/i).fill("30");

    // Select difficulty (Hard = 1.5x)
    await page.locator("[role='dialog']").getByLabel(/difficulty/i).selectOption({ value: "1.5" });

    // Submit
    await page.locator("[role='dialog']").getByRole("button", { name: /log|submit/i }).click();

    // Toast or success message with XP earned
    await expect(
      page.getByText(/xp/i).first()
    ).toBeVisible({ timeout: 5_000 });

    // Modal should close
    await expect(page.locator("[role='dialog']")).not.toBeVisible({ timeout: 5_000 });
  });
});

// ---------------------------------------------------------------------------
// TC-S004-E03: Session history visible after logging
// ---------------------------------------------------------------------------

test.describe("TC-S004-E03: Session history visible after logging", () => {
  test("logged session appears in session history", async ({ page }) => {
    const email = uniqueEmail();
    await setupReadyUser(page, email);
    await createSkillAndGetId(page);

    await page.goto("/skills");

    // Expand Body category
    const bodyHeader = page.locator("button").filter({ hasText: "Body" }).first();
    await bodyHeader.click();

    // Log a session
    await page.getByRole("button", { name: /log session/i }).first().click();
    await page.locator("[role='dialog']").getByLabel(/duration/i).fill("45");
    await page.locator("[role='dialog']").getByRole("button", { name: /log|submit/i }).click();

    // Wait for modal to close
    await expect(page.locator("[role='dialog']")).not.toBeVisible({ timeout: 5_000 });

    // Click "History" or "View History" button to see sessions
    const historyButton = page.getByRole("button", { name: /history/i }).first();
    await expect(historyButton).toBeVisible({ timeout: 5_000 });
    await historyButton.click();

    // Session entry should be visible (shows XP or duration)
    await expect(page.getByText(/45 min/i).first()).toBeVisible({ timeout: 5_000 });
  });
});
