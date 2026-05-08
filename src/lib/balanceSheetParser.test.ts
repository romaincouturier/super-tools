import { describe, it, expect } from "vitest";
import {
  computeBFR,
  computeTresorerieNette,
  computeRatioAutonomie,
  computeRentabiliteNette,
  computeFondsRoulement,
  computeImmobilisationsTotal,
  isBalanceConsistent,
  emptyBalanceSheet,
  type BalanceSheetData,
} from "./balanceSheetParser";

function sampleBalance(): BalanceSheetData {
  return {
    annee: 2025,
    actif: {
      immobilisations_incorporelles: 5000,
      immobilisations_corporelles: 45000,
      immobilisations_financieres: 0,
      stocks: 12000,
      creances_clients: 38000,
      autres_creances: 5000,
      disponibilites: 25000,
      valeurs_mobilieres_placement: 10000,
      total_actif: 140000,
    },
    passif: {
      capital_social: 10000,
      reserves: 18000,
      resultat_exercice: 12000,
      capitaux_propres: 40000,
      provisions: 5000,
      dettes_financieres_long_terme: 30000,
      dettes_financieres_court_terme: 8000,
      dettes_fournisseurs_court_terme: 22000,
      dettes_fiscales_sociales_court_terme: 25000,
      autres_dettes_court_terme: 10000,
      total_passif: 140000,
    },
    compte_resultat: {
      chiffre_affaires: 250000,
      charges_exploitation: 220000,
      resultat_exploitation: 30000,
      resultat_financier: -2000,
      resultat_exceptionnel: 0,
      impot_societes: 8000,
      resultat_net: 20000,
    },
  };
}

describe("balanceSheetParser", () => {
  it("computeBFR : stocks + créances clients - dettes fournisseurs CT", () => {
    const d = sampleBalance();
    expect(computeBFR(d)).toBe(12000 + 38000 - 22000);
  });

  it("computeTresorerieNette : disponibilités + VMP - dettes financières CT", () => {
    const d = sampleBalance();
    expect(computeTresorerieNette(d)).toBe(25000 + 10000 - 8000);
  });

  it("computeRatioAutonomie : capitaux propres / total passif (en %)", () => {
    const d = sampleBalance();
    expect(computeRatioAutonomie(d)).toBeCloseTo((40000 / 140000) * 100, 5);
  });

  it("computeRatioAutonomie : 0 si total passif vide", () => {
    const d = emptyBalanceSheet(2025);
    expect(computeRatioAutonomie(d)).toBe(0);
  });

  it("computeRentabiliteNette : résultat net / CA (en %)", () => {
    const d = sampleBalance();
    expect(computeRentabiliteNette(d)).toBeCloseTo((20000 / 250000) * 100, 5);
  });

  it("computeRentabiliteNette : 0 si CA absent", () => {
    const d = emptyBalanceSheet(2025);
    expect(computeRentabiliteNette(d)).toBe(0);
  });

  it("computeFondsRoulement : capitaux propres + dettes LT - immo", () => {
    const d = sampleBalance();
    expect(computeFondsRoulement(d)).toBe(40000 + 30000 - (5000 + 45000 + 0));
  });

  it("computeImmobilisationsTotal additionne les 3 catégories", () => {
    const d = sampleBalance();
    expect(computeImmobilisationsTotal(d)).toBe(50000);
  });

  it("isBalanceConsistent : true quand total actif == total passif", () => {
    expect(isBalanceConsistent(sampleBalance())).toBe(true);
  });

  it("isBalanceConsistent : false quand l'écart dépasse la tolérance", () => {
    const d = sampleBalance();
    d.actif.total_actif = 141000;
    expect(isBalanceConsistent(d, 1)).toBe(false);
  });

  it("isBalanceConsistent : true si l'écart est sous tolérance", () => {
    const d = sampleBalance();
    d.actif.total_actif = 140000.5;
    expect(isBalanceConsistent(d, 1)).toBe(true);
  });
});
