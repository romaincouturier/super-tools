import { describe, expect, it } from "vitest";
import { getDossierFee } from "./dossier-fee.ts";

describe("getDossierFee", () => {
  it("facture 150€ sans subrogation", () => {
    expect(getDossierFee(false, false)).toBe(150);
  });

  it("facture 350€ avec subrogation", () => {
    expect(getDossierFee(false, true)).toBe(350);
  });

  it("offre les 150€ sans subrogation", () => {
    expect(getDossierFee(true, false)).toBe(0);
  });

  it("retire 150€ des 350€ avec subrogation", () => {
    expect(getDossierFee(true, true)).toBe(200);
  });

  it("ne descend jamais sous 0", () => {
    expect(getDossierFee(true, false)).toBeGreaterThanOrEqual(0);
  });

  it("accepte un montant de remise personnalise", () => {
    expect(getDossierFee(50, false)).toBe(100);
    expect(getDossierFee(200, true)).toBe(150);
  });

  it("plafonne la remise au montant des frais", () => {
    expect(getDossierFee(500, false)).toBe(0);
    expect(getDossierFee(500, true)).toBe(0);
  });

  it("traite 0 comme aucune remise", () => {
    expect(getDossierFee(0, false)).toBe(150);
  });
});
