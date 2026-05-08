import { describe, it, expect } from "vitest";
import { isFixedCost, FIXED_COST_KEYWORDS } from "./pennylaneCategoryMap";

describe("isFixedCost", () => {
  it("retourne false pour une chaîne vide ou nulle", () => {
    expect(isFixedCost("")).toBe(false);
    expect(isFixedCost(null)).toBe(false);
    expect(isFixedCost(undefined)).toBe(false);
  });

  it("matche un mot-clé simple insensible à la casse", () => {
    expect(isFixedCost("Loyer du bureau")).toBe(true);
    expect(isFixedCost("LOYER bureau")).toBe(true);
    expect(isFixedCost("loyer")).toBe(true);
  });

  it("matche les charges récurrentes typiques d'une TPE", () => {
    expect(isFixedCost("Abonnement SaaS Notion")).toBe(true);
    expect(isFixedCost("Salaire mars")).toBe(true);
    expect(isFixedCost("Assurance professionnelle")).toBe(true);
    expect(isFixedCost("Mutuelle entreprise")).toBe(true);
    expect(isFixedCost("EDF Pro - Électricité")).toBe(true);
    expect(isFixedCost("Internet fibre Orange")).toBe(true);
    expect(isFixedCost("Honoraires expert-comptable")).toBe(true);
    expect(isFixedCost("Hébergement OVH")).toBe(true);
    expect(isFixedCost("Domiciliation entreprise")).toBe(true);
  });

  it("retourne false pour une charge variable / ponctuelle", () => {
    expect(isFixedCost("Restaurant client")).toBe(false);
    expect(isFixedCost("Achat matériel ponctuel")).toBe(false);
    expect(isFixedCost("Commission sur vente")).toBe(false);
    expect(isFixedCost("Frais de déplacement")).toBe(false);
  });

  it("matche un substring (le mot-clé peut être dans une phrase)", () => {
    expect(isFixedCost("Facture loyer Q1 2026")).toBe(true);
    expect(isFixedCost("Renouvellement abonnement annuel")).toBe(true);
  });

  it("matche les variantes accentuées ET sans accent (téléphonie/telephonie)", () => {
    expect(isFixedCost("Téléphonie Bouygues")).toBe(true);
    expect(isFixedCost("telephonie pro")).toBe(true);
    expect(isFixedCost("Électricité bureau")).toBe(true);
    expect(isFixedCost("electricite janvier")).toBe(true);
  });

  it("FIXED_COST_KEYWORDS contient au moins les classiques attendus", () => {
    expect(FIXED_COST_KEYWORDS).toContain("loyer");
    expect(FIXED_COST_KEYWORDS).toContain("abonnement");
    expect(FIXED_COST_KEYWORDS).toContain("salaire");
    expect(FIXED_COST_KEYWORDS).toContain("assurance");
  });
});
