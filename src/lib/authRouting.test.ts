import { describe, it, expect } from "vitest";
import { sanitizeRedirect, buildLoginPath, resolvePostLoginPath, LEARNER_HOME, STAFF_HOME } from "./authRouting";

describe("sanitizeRedirect", () => {
  it("accepte une destination interne", () => {
    expect(sanitizeRedirect("/espace-apprenant/pratique?post=42")).toBe("/espace-apprenant/pratique?post=42");
  });
  it("refuse une URL externe", () => {
    expect(sanitizeRedirect("https://exemple.fr/piege")).toBeNull();
  });
  it("refuse une URL protocole-relative", () => {
    expect(sanitizeRedirect("//exemple.fr/piege")).toBeNull();
  });
  it("refuse les portes de connexion, pour ne pas boucler", () => {
    expect(sanitizeRedirect("/connexion")).toBeNull();
    expect(sanitizeRedirect("/auth")).toBeNull();
  });
  it("refuse une valeur vide", () => {
    expect(sanitizeRedirect("")).toBeNull();
    expect(sanitizeRedirect(null)).toBeNull();
  });
});

describe("buildLoginPath", () => {
  it("mémorise la destination", () => {
    expect(buildLoginPath("/connexion", "/espace-apprenant/travaux"))
      .toBe("/connexion?next=%2Fespace-apprenant%2Ftravaux");
  });
  it("n'ajoute rien pour une destination refusée", () => {
    expect(buildLoginPath("/connexion", "/connexion")).toBe("/connexion");
  });
});

describe("resolvePostLoginPath", () => {
  it("envoie l'apprenant sur son tableau de bord par défaut", () => {
    expect(resolvePostLoginPath({ isStaff: false, mustChangePassword: false })).toBe(LEARNER_HOME);
  });
  it("envoie le staff sur le back-office par défaut", () => {
    expect(resolvePostLoginPath({ isStaff: true, mustChangePassword: false })).toBe(STAFF_HOME);
  });
  it("respecte la destination mémorisée de l'apprenant dans son espace", () => {
    expect(resolvePostLoginPath({ isStaff: false, mustChangePassword: false, next: "/espace-apprenant/pratique" }))
      .toBe("/espace-apprenant/pratique");
  });
  it("ne renvoie jamais un apprenant vers une route back-office", () => {
    expect(resolvePostLoginPath({ isStaff: false, mustChangePassword: false, next: "/crm" })).toBe(LEARNER_HOME);
  });
  it("laisse le staff rejoindre la destination mémorisée", () => {
    expect(resolvePostLoginPath({ isStaff: true, mustChangePassword: false, next: "/crm" })).toBe("/crm");
  });
  it("envoie un compte sans rattachement sur son écran dédié", () => {
    expect(resolvePostLoginPath({ isStaff: false, mustChangePassword: false, hasAccess: false }))
      .toBe("/compte-sans-acces");
  });

  it("ne renvoie pas un compte sans rattachement vers une destination mémorisée", () => {
    expect(resolvePostLoginPath({
      isStaff: false, mustChangePassword: false, hasAccess: false, next: "/espace-apprenant/pratique",
    })).toBe("/compte-sans-acces");
  });

  it("fait passer le changement de mot de passe obligatoire avant tout", () => {
    expect(resolvePostLoginPath({ isStaff: true, mustChangePassword: true, next: "/crm" }))
      .toBe("/force-password-change");
  });
});
