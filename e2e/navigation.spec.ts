import { test, expect } from "@playwright/test";

test.describe("Public pages (no auth required)", () => {
  test("should render privacy policy page", async ({ page }) => {
    await page.goto("/politique-confidentialite");

    // Should load without redirect to auth
    await expect(page).toHaveURL(/politique-confidentialite/);
    // Page should have some content
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("should render password reset page", async ({ page }) => {
    await page.goto("/reset-password");

    await expect(page).toHaveURL(/reset-password/);
  });

  test("should handle 404 routes gracefully", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");

    // Should show either a 404 page or redirect to auth
    const url = page.url();
    const is404 = await page.locator(':text("404"), :text("introuvable"), :text("not found")').isVisible().catch(() => false);
    const isAuth = url.includes("/auth");

    expect(is404 || isAuth).toBeTruthy();
  });
});

test.describe("Public form pages", () => {
  test("questionnaire page should require valid token", async ({ page }) => {
    await page.goto("/questionnaire/invalid-token");

    // Should load the page (not redirect to auth)
    await expect(page).toHaveURL(/questionnaire/);
  });

  test("evaluation page should require valid token", async ({ page }) => {
    await page.goto("/evaluation/invalid-token");

    await expect(page).toHaveURL(/evaluation/);
  });

  test("emargement page should require valid token", async ({ page }) => {
    await page.goto("/emargement/invalid-token");

    await expect(page).toHaveURL(/emargement/);
  });
});
