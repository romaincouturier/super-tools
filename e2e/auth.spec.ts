import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("should show login page at /auth", async ({ page }) => {
    await page.goto("/auth");

    // Auth page should render with email and password fields
    await expect(page.locator('input[type="email"], input[placeholder*="email" i]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("should redirect unauthenticated user to /auth", async ({ page }) => {
    await page.goto("/");

    // Should redirect to auth page
    await page.waitForURL(/\/auth/);
    await expect(page).toHaveURL(/\/auth/);
  });

  test("should show error on invalid credentials", async ({ page }) => {
    await page.goto("/auth");

    await page.fill('input[type="email"], input[placeholder*="email" i]', "invalid@example.com");
    await page.fill('input[type="password"]', "wrongpassword");

    // Find and click the submit button
    const submitButton = page.locator('button[type="submit"], button:has-text("Connexion"), button:has-text("Se connecter")');
    await submitButton.click();

    // Should show an error message (toast or inline)
    await expect(
      page.locator('[role="alert"], [data-sonner-toaster], .text-destructive, :text("Erreur"), :text("Invalid")')
    ).toBeVisible({ timeout: 10000 });
  });

  test("should display forgot password dialog", async ({ page }) => {
    await page.goto("/auth");

    // Click forgot password link
    const forgotLink = page.locator(':text("Mot de passe oublié"), :text("mot de passe")');
    if (await forgotLink.isVisible()) {
      await forgotLink.click();

      // Dialog should appear
      await expect(page.locator('[role="dialog"]')).toBeVisible();
    }
  });
});
