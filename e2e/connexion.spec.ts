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
  // Retour vers l'étape email, sans ambiguïté sur ce que fait le bouton.
  await expect(page.getByRole("button", { name: "Revenir à la page de connexion" })).toBeVisible();
  // Le lien de connexion par email n'a plus sa place ici : il double
  // "Mot de passe oublié" sans que la différence soit compréhensible.
  await expect(page.getByRole("button", { name: /Recevoir un lien de connexion/ })).not.toBeVisible();
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
  // L'action principale mène à la création de compte, pas à un cul-de-sac.
  await expect(page.getByRole("link", { name: "Créer un compte gratuitement" })).toBeVisible();
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
  // RG-21 : rien ne se consomme au chargement, l'apprenant agit d'abord.
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Accéder à mon espace");
  await page.getByRole("button", { name: "Ouvrir mon espace" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ce lien a expiré");
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Recevoir un nouveau lien" })).toBeVisible();
});

test("un lien déjà utilisé explique pourquoi et relance le parcours", async ({ page }) => {
  await stubEdge(page, "redeem-learner-token", { status: "used", email: "apprenant@exemple.fr" });
  await stubEdge(page, "resolve-login-identity", { state: "password" });
  await stubEdge(page, "send-learner-magic-link", { success: true });
  await page.goto("/connexion/lien?token=deja-servi");
  await page.getByRole("button", { name: "Ouvrir mon espace" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ce lien a déjà servi");
  await page.getByRole("button", { name: "Recevoir un nouveau lien" }).click();
  await expect(page.getByText(/un nouveau lien vient de partir/)).toBeVisible();
});

test("le renvoi d'un lien mort redemande le type de lien, il ne force plus la connexion", async ({ page }) => {
  await stubEdge(page, "redeem-learner-token", { status: "expired", email: "sanscompte@exemple.fr" });
  await stubEdge(page, "resolve-login-identity", { state: "activation" });
  let sentPurpose: string | null = null;
  await page.route("**/functions/v1/send-learner-magic-link", async (route) => {
    sentPurpose = route.request().postDataJSON()?.purpose ?? null;
    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ success: true }),
    });
  });
  await page.goto("/connexion/lien?token=perime");
  await page.getByRole("button", { name: "Ouvrir mon espace" }).click();
  await page.getByRole("button", { name: "Recevoir un nouveau lien" }).click();
  await expect(page.getByText(/un nouveau lien vient de partir/)).toBeVisible();
  // Un participant sans compte a besoin d'une activation (7 jours), pas
  // d'une connexion (30 minutes) : forcer "login" lui aurait envoyé un lien
  // deux fois plus court que celui dont il a besoin.
  expect(sentPurpose).toBe("activation");
});

test("une URL de lien sans jeton ne montre jamais d'erreur technique", async ({ page }) => {
  await page.goto("/connexion/lien");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ce lien n'est pas valide");
  await expect(page.getByRole("button", { name: /J.ai un mot de passe/ })).toBeVisible();
});

// ── Recette : critères 5, 13, 22 ────────────────────────────────────────────

test("un service d'ouverture en panne n'accuse pas le lien de l'apprenant", async ({ page }) => {
  await stubEdge(page, "redeem-learner-token", null);
  await page.goto("/connexion/lien?token=service-en-panne");
  await page.getByRole("button", { name: "Ouvrir mon espace" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Nous n'arrivons pas à ouvrir");
  // Une porte de sortie qui ne dépend pas de la chaîne en panne.
  await page.getByRole("button", { name: /Me connecter avec mon mot de passe/ }).click();
  await expect(page).toHaveURL(/\/connexion$/);
});

test("l'ancienne adresse de lien sans jeton mène à la connexion, jamais à une erreur", async ({ page }) => {
  await page.goto("/apprenant/connexion");
  await expect(page).toHaveURL(/\/connexion$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Se connecter");
});

test("un ancien lien reçu par email entre par la nouvelle ouverture de lien", async ({ page }) => {
  await stubEdge(page, "redeem-learner-token", { status: "used", email: "apprenant@exemple.fr" });
  await page.goto("/apprenant/connexion?token=ancien-jeton");
  await expect(page).toHaveURL(/\/connexion\/lien\?token=ancien-jeton$/);
  await page.getByRole("button", { name: "Ouvrir mon espace" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ce lien a déjà servi");
});

test("l'ancienne adresse de réinitialisation mène au nouvel écran", async ({ page }) => {
  await page.goto("/apprenant/reset-password");
  await expect(page).toHaveURL(/\/connexion\/reinitialisation$/);
});

test("un compte sans rattachement voit un écran explicite, sans boucle", async ({ page }) => {
  await page.goto("/compte-sans-acces");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("n'a pas encore d'accès");
  await expect(page.getByRole("link", { name: /Écrire au support/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Me déconnecter/ })).toBeVisible();
});

test("un lien pré-cliqué par un robot de messagerie reste utilisable", async ({ page }) => {
  let calls = 0;
  await page.route("**/functions/v1/redeem-learner-token", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    calls += 1;
    await route.fulfill({
      status: 200,
      headers: { ...CORS, "content-type": "application/json" },
      body: JSON.stringify({ status: "expired" }),
    });
  });

  // Simule l'ouverture automatique : la page se charge, rien n'est consommé.
  await page.goto("/connexion/lien?token=pre-clique");
  await expect(page.getByRole("button", { name: "Ouvrir mon espace" })).toBeVisible();
  expect(calls).toBe(0);
});

// ── Bandeau d'information pendant la migration ──────────────────────────────

async function stubSetting(page: Page, values: Record<string, string | null>) {
  await page.route("**/rest/v1/rpc/get_app_setting_public", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    const body = route.request().postDataJSON() as { p_key?: string };
    await route.fulfill({
      status: 200,
      headers: { ...CORS, "content-type": "application/json" },
      body: JSON.stringify(values[body?.p_key ?? ""] ?? null),
    });
  });
}

test("le bandeau d'information s'affiche sur la connexion quand il est activé", async ({ page }) => {
  await stubSetting(page, {
    maintenance_banner_enabled: "true",
    maintenance_banner_message: "Quelques difficultés d'accès sont possibles.",
  });
  await page.goto("/connexion");
  await expect(page.getByText("On fait quelques travaux sur SuperTools")).toBeVisible();
  await expect(page.getByText("Quelques difficultés d'accès sont possibles.")).toBeVisible();
});

test("le bandeau reste absent quand il n'est pas activé", async ({ page }) => {
  await stubSetting(page, { maintenance_banner_enabled: "false" });
  await page.goto("/connexion");
  await expect(page.getByText("On fait quelques travaux sur SuperTools")).toHaveCount(0);
});

test("le bandeau accompagne aussi le mot de passe oublié", async ({ page }) => {
  await stubSetting(page, { maintenance_banner_enabled: "true" });
  await page.goto("/connexion/mot-de-passe-oublie");
  await expect(page.getByText("On fait quelques travaux sur SuperTools")).toBeVisible();
});
