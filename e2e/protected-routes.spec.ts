import { test, expect } from "@playwright/test";

test.describe("Protected routes redirect to auth", () => {
  const protectedRoutes = [
    { path: "/", name: "Dashboard" },
    { path: "/crm", name: "CRM" },
    { path: "/formations", name: "Formations" },
    { path: "/missions", name: "Missions" },
    { path: "/okr", name: "OKR" },
    { path: "/evenements", name: "Events" },
    { path: "/contenu", name: "Content" },
    { path: "/media", name: "Media" },
    { path: "/settings", name: "Settings" },
    { path: "/monitoring", name: "Monitoring" },
  ];

  for (const route of protectedRoutes) {
    test(`${route.name} (${route.path}) redirects to /auth`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForURL(/\/auth/, { timeout: 10000 });
      await expect(page).toHaveURL(/\/auth/);
    });
  }
});

test.describe("Auth page interactions", () => {
  test("login form validates empty fields", async ({ page }) => {
    await page.goto("/auth");

    const submitButton = page.locator(
      'button[type="submit"], button:has-text("Connexion"), button:has-text("Se connecter")',
    );
    await submitButton.click();

    // Should show validation (HTML5 required or custom)
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]');
    const isInvalid = await emailInput.evaluate(
      (el) => !(el as HTMLInputElement).checkValidity(),
    );
    expect(isInvalid).toBeTruthy();
  });

  test("login form accepts email format only", async ({ page }) => {
    await page.goto("/auth");

    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]');
    await emailInput.fill("not-an-email");

    const submitButton = page.locator(
      'button[type="submit"], button:has-text("Connexion"), button:has-text("Se connecter")',
    );
    await submitButton.click();

    const isInvalid = await emailInput.evaluate(
      (el) => !(el as HTMLInputElement).checkValidity(),
    );
    expect(isInvalid).toBeTruthy();
  });

  test("password field toggles visibility", async ({ page }) => {
    await page.goto("/auth");

    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill("mypassword");

    // Look for toggle visibility button
    const toggleButton = page.locator(
      'button:near(input[type="password"]):not([type="submit"])',
    );
    if (await toggleButton.first().isVisible()) {
      await toggleButton.first().click();
      // Password field should switch to text type
      await expect(page.locator('input[type="text"][value="mypassword"]')).toBeVisible({
        timeout: 2000,
      });
    }
  });
});
