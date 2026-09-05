import { describe, expect, it } from "vitest";
import { computeDevisTotals } from "./devisPricing";

describe("computeDevisTotals", () => {
  it("sans subrogation, sans remise", () => {
    const t = computeDevisTotals({ prixUnitaire: 1000, nbParticipants: 2, variant: "sans" });
    expect(t).toMatchObject({ prixFormation: 2000, baseFrais: 150, remise: 0, frais: 150, totalHT: 2150, totalTTC: 2150 });
  });

  it("avec subrogation, sans remise", () => {
    const t = computeDevisTotals({ prixUnitaire: 1000, nbParticipants: 1, variant: "avec" });
    expect(t).toMatchObject({ baseFrais: 350, frais: 350, totalHT: 1350 });
  });

  it("sans subrogation, frais offerts", () => {
    const t = computeDevisTotals({ prixUnitaire: 1000, nbParticipants: 1, variant: "sans", offrirFraisAdmin: true });
    expect(t).toMatchObject({ remise: 150, frais: 0, totalHT: 1000 });
  });

  it("avec subrogation, frais offerts", () => {
    const t = computeDevisTotals({ prixUnitaire: 1000, nbParticipants: 1, variant: "avec", offrirFraisAdmin: true });
    expect(t).toMatchObject({ remise: 150, frais: 200, totalHT: 1200 });
  });

  it("frais jamais négatifs", () => {
    const t = computeDevisTotals({ prixUnitaire: 0, nbParticipants: 0, variant: "sans", offrirFraisAdmin: true });
    expect(t.frais).toBe(0);
    expect(t.totalHT).toBe(0);
  });

  it("montant de remise personnalise", () => {
    const t = computeDevisTotals({ prixUnitaire: 1000, nbParticipants: 1, variant: "avec", remiseFraisAdmin: 200 });
    expect(t).toMatchObject({ remise: 200, frais: 150, totalHT: 1150 });
  });

  it("remise plafonnee aux frais de base", () => {
    const t = computeDevisTotals({ prixUnitaire: 1000, nbParticipants: 1, variant: "sans", remiseFraisAdmin: 900 });
    expect(t).toMatchObject({ remise: 150, frais: 0, totalHT: 1000 });
  });

  it("remise 0 prime sur l ancien booleen", () => {
    const t = computeDevisTotals({ prixUnitaire: 1000, nbParticipants: 1, variant: "sans", remiseFraisAdmin: 0, offrirFraisAdmin: true });
    expect(t.frais).toBe(150);
  });

  it("brouillon ancien: booleen true vaut 150", () => {
    const t = computeDevisTotals({ prixUnitaire: 1000, nbParticipants: 1, variant: "sans", offrirFraisAdmin: true });
    expect(t.frais).toBe(0);
  });
});
