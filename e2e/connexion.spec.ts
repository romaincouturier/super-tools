import { test, expect, type Page } from "@playwright/test";

// Parcours de connexion (lots 2 et 3). Les appels au service de résolution sont
// interceptés pour rendre chaque état déterministe, sans dépendre du serveur.

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "POST, OPTIONS",
};

async function stubEdge(page: Page, name: string, body: unknown | null) {
  await page.route(`**/functions/v1/${name}`, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    if (body === null) {
      await route.abort("failed");
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { ...CORS, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  });
}

async function submitEmail(page: Page, email = "apprenant@exemple.fr") {
  await page.locator('input[type="email"]').fill(email);
  await page.getByRole("button", { name: "Continuer" }).click();
}

test("la connexion demande l'adresse avant toute autre chose", async ({ page }) => {
  await page.goto("/connexion");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Se connecter");
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
});

test("un compte avec mot de passe mène à l'étape mot de passe", async ({ page }) => {
  await stubEdge(page, "resolve-login-identity", { state: "password" });
  await page.goto("/connexion");
  await submitEmail(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Content de vous revoir");
  await expect(page.locator('input[type="password"]')).toBeVisible();
  // L'adresse reste dans le formulaire pour les gestionnaires de mots de passe.
  await expect(page.locator('input[type="email"]')).toHaveValue("apprenant@exemple.fr");
});

test("un compte sans mot de passe reçoit un lien de connexion", async ({ page }) => {
  await stubEdge(page, "resolve-login-identity", { state: "link" });
  await stubEdge(page, "send-learner-magic-link", { success: true });
  await page.goto("/connexion");
  await submitEmail(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Vérifiez votre boîte mail");
  await expect(page.getByText(/valable 30 minutes/)).toBeVisible();
});

test("un participant sans compte reçoit un lien d'activation", async ({ page }) => {
  await stubEdge(page, "resolve-login-identity", { state: "activation" });
  await stubEdge(page, "send-learner-magic-link", { success: true });
  await page.goto("/connexion");
  await submitEmail(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Votre accès est prêt");
  await expect(page.getByText(/valable 7 jours/)).toBeVisible();
});

test("une adresse inconnue propose des pistes, jamais un cul-de-sac", async ({ page }) => {
  await stubEdge(page, "resolve-login-identity", { state: "unknown" });
  await page.goto("/connexion");
  await submitEmail(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Nous n'avons pas trouvé de compte");
  await expect(page.getByRole("button", { name: "Essayer une autre adresse" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Écrire au support/ })).toBeVisible();
});

test("au-delà du quota, le message est uniforme et aucun lien ne part", async ({ page }) => {
  await stubEdge(page, "resolve-login-identity", { state: "throttled" });
  await page.goto("/connexion");
  await submitEmail(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Trop de tentatives");
});

test("si le service de résolution ne répond pas, l'écran bascule en mode dégradé", async ({ page }) => {
  await stubEdge(page, "resolve-login-identity", null);
  await page.goto("/connexion");
  await submitEmail(page);
  await expect(page.getByText(/Nous n'avons pas pu identifier votre compte/)).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
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
  await stubEdge(page, "resolve-login-identity", { state: "password" });
  await page.goto("/connexion");
  await submitEmail(page);
  await page.getByRole("link", { name: /Mot de passe oublié/ }).click();
  await expect(page).toHaveURL(/\/connexion\/mot-de-passe-oublie$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Mot de passe oublié");
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

// ── Ouverture d'un lien reçu par email (W5, W10) ────────────────────────────

test("un lien expiré propose d'en recevoir un nouveau, sans cul-de-sac", async ({ page }) => {
  await stubEdge(page, "redeem-learner-token", { status: "expired" });
  await page.goto("/connexion/lien?token=peu-importe");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ce lien a expiré");
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Recevoir un nouveau lien" })).toBeVisible();
});

test("un lien déjà utilisé explique pourquoi et relance le parcours", async ({ page }) => {
  await stubEdge(page, "redeem-learner-token", { status: "used", email: "apprenant@exemple.fr" });
  await stubEdge(page, "send-learner-magic-link", { success: true });
  await page.goto("/connexion/lien?token=deja-servi");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ce lien a déjà servi");
  await page.getByRole("button", { name: "Recevoir un nouveau lien" }).click();
  await expect(page.getByText(/un nouveau lien vient de partir/)).toBeVisible();
});

test("une URL de lien sans jeton ne montre jamais d'erreur technique", async ({ page }) => {
  await page.goto("/connexion/lien");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ce lien n'est pas valide");
  await expect(page.getByRole("button", { name: /J.ai un mot de passe/ })).toBeVisible();
});
