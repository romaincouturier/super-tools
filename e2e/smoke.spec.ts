import { test, expect } from "@playwright/test";

// Smoke tests : vérifient que l'app buildée se charge sans écran blanc
// (régression type [011] PWA / chunks) et que les pages publiques critiques
// rendent leur contenu. Les golden paths authentifiés (LMS, uploads, CRM)
// nécessitent des comptes de test — à ajouter ici par module.

test("la landing page se charge sans écran blanc", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1").first()).toBeVisible();
  // Le lien de connexion mène à l'espace apprenant depuis la refonte de la
  // landing. Il est rendu deux fois — barre de navigation et menu mobile —
  // d'où le premier des deux.
  await expect(page.getByRole("link", { name: "Se connecter" }).first()).toBeVisible();
});

test("la page /auth affiche le formulaire de connexion", async ({ page }) => {
  await page.goto("/auth");
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test("une route inconnue ne rend pas une page vide", async ({ page }) => {
  await page.goto("/cette-route-n-existe-pas");
  const rootText = await page.locator("#root").innerText();
  expect(rootText.trim().length).toBeGreaterThan(0);
});
