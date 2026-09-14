import { test, expect } from "@playwright/test";

// Parcours de connexion (lot 2). Ces scénarios ne demandent pas de compte :
// ils vérifient les écrans publics, les redirections et l'absence de cul-de-sac.

test("la page de connexion présente les deux champs et les portes de secours", async ({ page }) => {
  await page.goto("/connexion");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Connexion");
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.getByRole("link", { name: /Mot de passe oublié/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Recevoir un lien de connexion/ })).toBeVisible();
});

test("l'ancienne URL /apprenant mène à la page de connexion", async ({ page }) => {
  await page.goto("/apprenant");
  await expect(page).toHaveURL(/\/connexion$/);
});

test("une page protégée renvoie vers la connexion en mémorisant la destination", async ({ page }) => {
  await page.goto("/espace-apprenant/pratique");
  await expect(page).toHaveURL(/\/connexion\?next=%2Fespace-apprenant%2Fpratique/);
});

test("le mot de passe oublié est atteignable sans lien reçu", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByRole("link", { name: /Mot de passe oublié/ }).click();
  await expect(page).toHaveURL(/\/connexion\/mot-de-passe-oublie$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Mot de passe oublié");
  await expect(page.locator('input[type="email"]')).toBeVisible();
});

test("un lien de réinitialisation sans session propose d'en recevoir un nouveau", async ({ page }) => {
  await page.goto("/connexion/reinitialisation");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("expiré");
  await page.getByRole("button", { name: /Recevoir un nouveau lien/ }).click();
  await expect(page).toHaveURL(/\/connexion\/mot-de-passe-oublie$/);
});

test("le lien Se connecter de la landing mène à la page de connexion", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Se connecter" }).first().click();
  await expect(page).toHaveURL(/\/connexion$/);
});
