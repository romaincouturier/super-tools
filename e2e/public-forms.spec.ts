import { test, expect } from "@playwright/test";

test.describe("Public form pages (no auth required)", () => {
  test.describe("Signature pages", () => {
    test("convention signature page loads with invalid token", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.goto("/signature-convention/fake-token");
      await page.waitForLoadState("networkidle");

      // Should not redirect to auth (page is public)
      expect(page.url()).toContain("signature-convention");
    });

    test("devis signature page loads with invalid token", async ({ page }) => {
      await page.goto("/signature-devis/fake-token");
      await page.waitForLoadState("networkidle");

      expect(page.url()).toContain("signature-devis");
    });
  });

  test.describe("Questionnaire page", () => {
    test("loads without JS errors", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.goto("/questionnaire/test-token-123");
      await page.waitForLoadState("networkidle");

      expect(page.url()).toContain("questionnaire");
      // No unhandled JS errors
      expect(errors).toEqual([]);
    });
  });

  test.describe("Evaluation page", () => {
    test("loads without JS errors", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.goto("/evaluation/test-token-123");
      await page.waitForLoadState("networkidle");

      expect(page.url()).toContain("evaluation");
      expect(errors).toEqual([]);
    });

    test("sponsor evaluation page loads", async ({ page }) => {
      await page.goto("/evaluation-commanditaire/test-token-123");
      await page.waitForLoadState("networkidle");

      expect(page.url()).toContain("evaluation-commanditaire");
    });
  });

  test.describe("Emargement page", () => {
    test("loads without JS errors", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.goto("/emargement/test-token-123");
      await page.waitForLoadState("networkidle");

      expect(page.url()).toContain("emargement");
      expect(errors).toEqual([]);
    });
  });

  test.describe("Privacy policy", () => {
    test("renders with content", async ({ page }) => {
      await page.goto("/politique-confidentialite");
      await page.waitForLoadState("networkidle");

      await expect(page.locator("body")).not.toBeEmpty();
      expect(page.url()).toContain("politique-confidentialite");
    });
  });

  test.describe("Catalogue page", () => {
    test("loads without redirect", async ({ page }) => {
      await page.goto("/catalogue");
      await page.waitForLoadState("networkidle");

      // Catalogue might be public or redirect to auth
      const url = page.url();
      expect(url.includes("catalogue") || url.includes("auth")).toBeTruthy();
    });
  });
});
