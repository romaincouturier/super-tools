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
});
