/**
 * S-003 — Skill tree: view and manage sub-skills under the four system categories
 * E2E tests (Playwright, baseURL: http://localhost:3002)
 *
 * These tests are written RED-first. The /skills page and its components do not
 * exist yet — all tests will fail. That is correct.
 *
 * Auth + profile setup pattern (required by middleware — unprofilied users are redirected):
 *   1. POST /api/auth/signup
 *   2. POST /api/auth/login   (sets httpOnly auth-token cookie)
 *   3. POST /api/profile/onboard  (required before /skills is accessible)
 *
 * AC coverage:
 *   AC-1: four categories (Body, Mind, Craft, Spirit) visible, each expandable
 *   AC-2: 'Add Sub-skill' creates a new row with xp=0 and UI updates
 *   AC-3: rename sub-skill updates name and is reflected in UI
 *   AC-4: delete sub-skill with no session logs removes from DB and UI
 *   AC-5: delete sub-skill with session logs shows confirmation dialog
 *   AC-6: current XP shown alongside skill name
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
  return `e2e-skills-${++emailCounter}-${Date.now()}@example.com`;
}

/**
 * Signs up, logs in, and completes onboarding so the user can access /skills.
 * The auth-token cookie is set automatically by the login response.
 */
async function setupReadyUser(page: Page, email: string): Promise<void> {
  // 1. Signup (idempotent — ignore 409)
  await page.request.post("/api/auth/signup", {
    data: { email, password: TEST_PASSWORD },
    headers: { "Content-Type": "application/json" },
    failOnStatusCode: false,
  });

  // 2. Login — sets httpOnly auth-token cookie
  await page.request.post("/api/auth/login", {
    data: { email, password: TEST_PASSWORD },
    headers: { "Content-Type": "application/json" },
  });

  // 3. Onboard — required before /skills is accessible
  await page.request.post("/api/profile/onboard", {
    data: { display_name: "SkillsTestUser", avatar_seed: "seed-skills-e2e" },
    headers: { "Content-Type": "application/json" },
    failOnStatusCode: false,
  });
}

// ---------------------------------------------------------------------------
// AC-1: Four categories visible and expandable
// ---------------------------------------------------------------------------

test.describe("AC-1: Four skill categories visible on /skills", () => {
  // TC-018
  test("TC-018: skills_four_categories_visible — all four system categories are displayed on /skills", async ({
    page,
  }) => {
    const email = uniqueEmail();
    await setupReadyUser(page, email);

    await page.goto("/skills");

    // Each category name must be visible on the page.
    await expect(page.getByText("Body")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Mind")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Craft")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Spirit")).toBeVisible({ timeout: 5_000 });
  });

  // TC-019
  test("TC-019: skills_categories_expandable — clicking a category header reveals its skill list", async ({
    page,
  }) => {
    const email = uniqueEmail();
    await setupReadyUser(page, email);

    await page.goto("/skills");

    // Find the "Body" category header (button or clickable element) and click it.
    // The CategoryAccordion component should expand on click.
    const bodyHeader = page
      .locator("[data-testid='category-body'], [aria-label*='Body' i], button")
      .filter({ hasText: "Body" })
      .first();

    await bodyHeader.click();

    // After expanding, the skill list container (or "Add Sub-skill" button) should be visible.
    // We check for a container with a data-testid or the Add Sub-skill button.
    const expanded = page.locator(
      "[data-testid='skill-list-body'], [data-testid*='skill-list'], [aria-label*='add sub-skill' i], button"
    ).filter({ hasText: /add sub-?skill/i }).first();

    await expect(expanded).toBeVisible({ timeout: 5_000 });
  });
});

// ---------------------------------------------------------------------------
// AC-2: Add sub-skill creates new row with xp=0
// ---------------------------------------------------------------------------

test.describe("AC-2: Add Sub-skill creates a new skill row", () => {
  // TC-020
  test("TC-020: skills_add_subskill — submitting 'Add Sub-skill' form creates a new row with XP=0", async ({
    page,
  }) => {
    const email = uniqueEmail();
    await setupReadyUser(page, email);

    await page.goto("/skills");

    // Expand the "Body" category.
    const bodyHeader = page
      .locator("[data-testid='category-body'], button")
      .filter({ hasText: "Body" })
      .first();
    await bodyHeader.click();

    // Click 'Add Sub-skill' button.
    const addButton = page
      .getByRole("button", { name: /add sub-?skill/i })
      .first();
    await addButton.click();

    // Fill in the skill name.
    const nameInput = page.locator(
      "input[name='skill_name'], input[placeholder*='skill' i], input[data-testid='skill-name-input']"
    ).first();
    await nameInput.fill("Morning Run");

    // Submit the form.
    await page
      .getByRole("button", { name: /save|add|create|submit/i })
      .last()
      .click();

    // The new skill row must appear in the UI.
    await expect(page.getByText("Morning Run")).toBeVisible({ timeout: 10_000 });

    // XP displayed alongside it must be 0.
    // The row should show "0 XP" or "XP: 0" or similar.
    const skillRow = page
      .locator("[data-testid*='skill-row'], li, tr")
      .filter({ hasText: "Morning Run" })
      .first();
    await expect(skillRow.getByText(/\b0\b/)).toBeVisible({ timeout: 5_000 });
  });
});

// ---------------------------------------------------------------------------
// AC-3: Rename sub-skill updates name in UI
// ---------------------------------------------------------------------------

test.describe("AC-3: Rename sub-skill reflects updated name in UI", () => {
  // TC-021
  test("TC-021: skills_rename_subskill — renaming a sub-skill updates its name in the skill tree", async ({
    page,
  }) => {
    const email = uniqueEmail();
    await setupReadyUser(page, email);

    await page.goto("/skills");

    // Expand "Mind" category and add a skill to rename.
    const mindHeader = page
      .locator("[data-testid='category-mind'], button")
      .filter({ hasText: "Mind" })
      .first();
    await mindHeader.click();

    const addButton = page
      .getByRole("button", { name: /add sub-?skill/i })
      .first();
    await addButton.click();

    const nameInput = page.locator(
      "input[name='skill_name'], input[placeholder*='skill' i], input[data-testid='skill-name-input']"
    ).first();
    await nameInput.fill("OldSkillName");

    await page
      .getByRole("button", { name: /save|add|create|submit/i })
      .last()
      .click();

    await expect(page.getByText("OldSkillName")).toBeVisible({ timeout: 10_000 });

    // Click rename button on the skill row.
    const skillRow = page
      .locator("[data-testid*='skill-row'], li, tr")
      .filter({ hasText: "OldSkillName" })
      .first();

    await skillRow
      .getByRole("button", { name: /rename|edit/i })
      .click();

    // Fill the rename form with a new name.
    const renameInput = page.locator(
      "input[name='skill_name'], input[data-testid='rename-input'], input[placeholder*='name' i]"
    ).first();
    await renameInput.clear();
    await renameInput.fill("NewSkillName");

    await page
      .getByRole("button", { name: /save|confirm|update|submit/i })
      .last()
      .click();

    // Old name gone, new name visible.
    await expect(page.getByText("NewSkillName")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("OldSkillName")).not.toBeVisible({ timeout: 5_000 });
  });
});

// ---------------------------------------------------------------------------
// AC-4: Delete sub-skill with no session logs removes from UI
// ---------------------------------------------------------------------------

test.describe("AC-4: Delete sub-skill with no session history removes it", () => {
  // TC-022
  test("TC-022: skills_delete_no_history — deleting a skill with no session logs removes it from the skill tree", async ({
    page,
  }) => {
    const email = uniqueEmail();
    await setupReadyUser(page, email);

    await page.goto("/skills");

    // Expand "Craft" and add a skill.
    const craftHeader = page
      .locator("[data-testid='category-craft'], button")
      .filter({ hasText: "Craft" })
      .first();
    await craftHeader.click();

    const addButton = page
      .getByRole("button", { name: /add sub-?skill/i })
      .first();
    await addButton.click();

    const nameInput = page.locator(
      "input[name='skill_name'], input[placeholder*='skill' i], input[data-testid='skill-name-input']"
    ).first();
    await nameInput.fill("PowerSkill");

    await page
      .getByRole("button", { name: /save|add|create|submit/i })
      .last()
      .click();

    await expect(page.getByText("PowerSkill")).toBeVisible({ timeout: 10_000 });

    // Click delete on the skill row — use ^Delete anchor so "Rename PowerSkill" is not matched.
    const skillRow = page
      .locator("[data-testid*='skill-row'], li, tr")
      .filter({ hasText: "PowerSkill" })
      .first();

    await skillRow
      .getByRole("button", { name: /^delete/i })
      .click();

    // If a confirmation dialog appears for a skill with no history, confirm it.
    // Scope to within a dialog so the "Deleting…" loading button is not matched.
    const confirmButton = page.locator("[role='dialog']").getByRole("button", { name: /confirm|yes|delete/i });
    if (await confirmButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmButton.click();
    }

    // Skill must no longer be visible.
    await expect(page.getByText("PowerSkill")).not.toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// AC-5: Delete sub-skill with session logs shows confirmation dialog
// ---------------------------------------------------------------------------

test.describe("AC-5: Delete sub-skill with session history shows confirmation dialog", () => {
  // TC-023
  test("TC-023: skills_delete_with_history_shows_dialog — deleting a skill that has session logs shows a warning confirmation dialog", async ({
    page,
  }) => {
    const email = uniqueEmail();
    await setupReadyUser(page, email);

    // First log in to get the auth-token cookie, then call the skill API directly
    // to create a skill and seed session history, so the E2E reflects the real scenario.
    // We create the skill via the BFF and seed history via the test endpoint.
    await page.goto("/skills");

    // Expand "Spirit" category and add a skill.
    const spiritHeader = page
      .locator("[data-testid='category-spirit'], button")
      .filter({ hasText: "Spirit" })
      .first();
    await spiritHeader.click();

    const addButton = page
      .getByRole("button", { name: /add sub-?skill/i })
      .first();
    await addButton.click();

    const nameInput = page.locator(
      "input[name='skill_name'], input[placeholder*='skill' i], input[data-testid='skill-name-input']"
    ).first();
    await nameInput.fill("MeditationPractice");

    await page
      .getByRole("button", { name: /save|add|create|submit/i })
      .last()
      .click();

    await expect(page.getByText("MeditationPractice")).toBeVisible({ timeout: 10_000 });

    // Seed session history for this skill via the BFF test-seed endpoint.
    // This endpoint proxies to the API's test-seed-history route.
    // We do this via page.request so the auth-token cookie is sent automatically.
    const skillsRes = await page.request.get("/api/skills");
    const skillsData = await skillsRes.json() as { categories: Array<{ name: string; skills: Array<{ id: string; name: string }> }> };
    const spiritCat = skillsData.categories.find((c) => c.name === "Spirit");
    const skill = spiritCat?.skills.find((s) => s.name === "MeditationPractice");

    if (skill) {
      await page.request.post(`/api/skills/${skill.id}/test-seed-history`, {
        data: {},
        headers: { "Content-Type": "application/json" },
        failOnStatusCode: false,
      });
    }

    // Reload the page so the UI reflects the seeded state.
    await page.goto("/skills");

    // Re-expand Spirit.
    const spiritHeader2 = page
      .locator("[data-testid='category-spirit'], button")
      .filter({ hasText: "Spirit" })
      .first();
    await spiritHeader2.click();

    await expect(page.getByText("MeditationPractice")).toBeVisible({ timeout: 10_000 });

    // Click delete on the skill row.
    const skillRow = page
      .locator("[data-testid*='skill-row'], li, tr")
      .filter({ hasText: "MeditationPractice" })
      .first();

    await skillRow
      .getByRole("button", { name: /^delete/i })
      .click();

    // A confirmation dialog must appear warning about history loss.
    const dialog = page.locator(
      "[role='dialog'], [data-testid='delete-confirm-dialog'], [data-testid='confirm-dialog']"
    ).first();

    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // The dialog must mention history deletion.
    await expect(
      page.getByText(/history|session|will also be deleted/i)
    ).toBeVisible({ timeout: 5_000 });
  });
});

// ---------------------------------------------------------------------------
// AC-6: Current XP shown alongside skill name
// ---------------------------------------------------------------------------

test.describe("AC-6: Current XP visible alongside skill name", () => {
  // TC-024
  test("TC-024: skills_xp_displayed — current XP value is visible next to the skill name", async ({
    page,
  }) => {
    const email = uniqueEmail();
    await setupReadyUser(page, email);

    await page.goto("/skills");

    // Expand "Body" and add a skill.
    const bodyHeader = page
      .locator("[data-testid='category-body'], button")
      .filter({ hasText: "Body" })
      .first();
    await bodyHeader.click();

    const addButton = page
      .getByRole("button", { name: /add sub-?skill/i })
      .first();
    await addButton.click();

    const nameInput = page.locator(
      "input[name='skill_name'], input[placeholder*='skill' i], input[data-testid='skill-name-input']"
    ).first();
    await nameInput.fill("XPCheckSkill");

    await page
      .getByRole("button", { name: /save|add|create|submit/i })
      .last()
      .click();

    await expect(page.getByText("XPCheckSkill")).toBeVisible({ timeout: 10_000 });

    // The SkillRow component must display the current_xp.
    // For a freshly created skill, current_xp=0.
    // We look for the XP value within or near the skill row.
    const skillRow = page
      .locator("[data-testid*='skill-row'], li, tr")
      .filter({ hasText: "XPCheckSkill" })
      .first();

    // Either "0 XP", "XP: 0", "0xp", etc.
    await expect(skillRow.getByText(/\b0\b/)).toBeVisible({ timeout: 5_000 });

    // Also verify that an XP-related label appears alongside the skill name.
    // The row must contain both the skill name AND an XP indicator.
    const xpIndicator = skillRow.locator(
      "[data-testid*='xp'], [aria-label*='xp' i], [class*='xp' i], span"
    ).filter({ hasText: /xp|\d+\s*xp/i }).first();

    // If a specific XP element exists, it must be visible.
    // If the implementation uses inline text like "0 XP" in the row, the previous
    // check with getByText covers it. This is a belt-and-suspenders check.
    const hasXpElement = await xpIndicator.isVisible().catch(() => false);
    const rowText = await skillRow.innerText().catch(() => "");

    // The row text must contain a number (the XP value).
    expect(hasXpElement || /\b\d+\b/.test(rowText)).toBe(true);
  });
});
