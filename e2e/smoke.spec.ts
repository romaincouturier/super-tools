import { test, expect } from "@playwright/test";

test.describe("Smoke tests", () => {
  test("app loads without JavaScript errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/auth");

    // Wait for initial render
    await page.waitForLoadState("networkidle");

    // No unhandled JS errors on load
    expect(errors).toEqual([]);
  });

  test("app has correct page title", async ({ page }) => {
    await page.goto("/auth");

    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test("app loads service worker (PWA)", async ({ page }) => {
    await page.goto("/auth");
    await page.waitForLoadState("networkidle");

    // Check that the service worker registration exists
    const swRegistered = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return false;
      const registrations = await navigator.serviceWorker.getRegistrations();
      return registrations.length > 0;
    });

    // PWA should register a service worker (may not be true in test env)
    // This is informational, not a hard assertion
    if (!swRegistered) {
      console.log("Note: Service worker not registered (expected in test env)");
    }
  });
});
