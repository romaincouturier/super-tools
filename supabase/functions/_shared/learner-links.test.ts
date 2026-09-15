import { describe, it, expect } from "vitest";
import { linkExpiresAt, linkValidityLabel } from "./learner-links.ts";

const NOW = new Date("2026-09-15T10:00:00.000Z");

describe("linkExpiresAt", () => {
  it("donne 30 minutes à un lien de connexion", () => {
    expect(linkExpiresAt("login", NOW).toISOString()).toBe("2026-09-15T10:30:00.000Z");
  });

  it("donne 7 jours à un lien d'activation", () => {
    expect(linkExpiresAt("activation", NOW).toISOString()).toBe("2026-09-22T10:00:00.000Z");
  });

  it("retient l'activation par défaut, l'usage le plus courant", () => {
    expect(linkExpiresAt(undefined, NOW).toISOString()).toBe("2026-09-22T10:00:00.000Z");
    expect(linkExpiresAt("n'importe quoi", NOW).toISOString()).toBe("2026-09-22T10:00:00.000Z");
  });
});

describe("linkValidityLabel", () => {
  it("annonce la durée réelle du lien de connexion", () => {
    expect(linkValidityLabel("login")).toContain("30 minutes");
    expect(linkValidityLabel("login")).toContain("qu'une fois");
  });

  it("annonce la durée réelle du lien d'activation", () => {
    expect(linkValidityLabel("activation")).toContain("7 jours");
  });
});
