import { describe, it, expect } from "vitest";
import {
  buildRiskRecord,
  criticalityBand,
  isReviewOverdue,
  modalityLabel,
  riskStatusLabel,
  scaleLabel,
  summarizeRisks,
  BAND_LABELS,
  EMPTY_RISK_FORM,
  IMPACT_LEVELS,
  PROBABILITY_LEVELS,
  type QualityRiskFormValues,
} from "./qualityRiskConstants";

const TODAY = "2026-09-08";

const risk = (over: Partial<Parameters<typeof summarizeRisks>[0][number]> = {}) => ({
  status: "open",
  criticality: 4,
  review_date: null,
  preventive_measure: "Doubler l'animateur",
  ...over,
});

describe("criticalityBand", () => {
  it("range chaque produit possible des deux échelles", () => {
    // Produits atteignables avec deux échelles de 1 à 4.
    expect([1, 2, 3].map(criticalityBand)).toEqual(["faible", "faible", "faible"]);
    expect([4, 6].map(criticalityBand)).toEqual(["modere", "modere"]);
    expect([8, 9].map(criticalityBand)).toEqual(["eleve", "eleve"]);
    expect([12, 16].map(criticalityBand)).toEqual(["critique", "critique"]);
  });

  it("expose un libellé pour chaque bande", () => {
    expect(Object.keys(BAND_LABELS)).toHaveLength(4);
    expect(BAND_LABELS.critique).toBe("Critique");
  });
});

describe("libellés", () => {
  it("rend le libellé d'une modalité et d'un statut connus", () => {
    expect(modalityLabel("distanciel_synchrone")).toBe("Distanciel synchrone");
    expect(riskStatusLabel("monitored")).toBe("Sous surveillance");
  });

  it("rend un tiret plutôt qu'une valeur brute pour l'inconnu", () => {
    expect(modalityLabel(null)).toBe("—");
    expect(riskStatusLabel("inexistant")).toBe("—");
  });

  it("nomme chaque niveau des deux échelles", () => {
    expect(scaleLabel(PROBABILITY_LEVELS, 4)).toBe("Très probable");
    expect(scaleLabel(IMPACT_LEVELS, 1)).toBe("Mineur");
  });

  it("retombe sur le chiffre pour un niveau hors échelle", () => {
    expect(scaleLabel(IMPACT_LEVELS, 9)).toBe("9");
  });
});

describe("isReviewOverdue", () => {
  it("signale une revue passée sur un risque actif", () => {
    expect(isReviewOverdue({ status: "open", review_date: "2026-09-01" }, TODAY)).toBe(true);
    expect(isReviewOverdue({ status: "monitored", review_date: "2026-09-01" }, TODAY)).toBe(true);
  });

  it("ne signale rien le jour même", () => {
    expect(isReviewOverdue({ status: "open", review_date: TODAY }, TODAY)).toBe(false);
  });

  it("ignore un risque clôturé et un risque sans date de revue", () => {
    expect(isReviewOverdue({ status: "closed", review_date: "2026-01-01" }, TODAY)).toBe(false);
    expect(isReviewOverdue({ status: "open", review_date: null }, TODAY)).toBe(false);
  });
});

describe("buildRiskRecord", () => {
  const form: QualityRiskFormValues = {
    ...EMPTY_RISK_FORM,
    label: "  Panne de connexion en distanciel  ",
    formation_config_id: "cfg-1",
    modality: "distanciel_synchrone",
    cause: "  Débit du formateur  ",
    probability: 3,
    impact: 4,
    preventive_measure: "Partage de connexion de secours",
    owner: "Romain",
    review_date: "2026-12-01",
    status: "monitored",
    reclamation_id: "rec-1",
    improvement_id: "imp-1",
  };

  it("nettoie les espaces et conserve les rattachements", () => {
    const record = buildRiskRecord(form);

    expect(record.label).toBe("Panne de connexion en distanciel");
    expect(record.cause).toBe("Débit du formateur");
    expect(record.formation_config_id).toBe("cfg-1");
    expect(record.reclamation_id).toBe("rec-1");
    expect(record.improvement_id).toBe("imp-1");
  });

  it("n'écrit jamais de criticité : la base la calcule", () => {
    expect(buildRiskRecord(form)).not.toHaveProperty("criticality");
    expect(buildRiskRecord(form).probability).toBe(3);
    expect(buildRiskRecord(form).impact).toBe(4);
  });

  it("rend null plutôt qu'une chaîne vide sur tout ce qui est facultatif", () => {
    const record = buildRiskRecord({ ...EMPTY_RISK_FORM, label: "Risque transverse" });

    expect(record.formation_config_id).toBeNull();
    expect(record.modality).toBeNull();
    expect(record.cause).toBeNull();
    expect(record.preventive_measure).toBeNull();
    expect(record.owner).toBeNull();
    expect(record.review_date).toBeNull();
    expect(record.reclamation_id).toBeNull();
    expect(record.improvement_id).toBeNull();
  });

  it("traite une mesure faite d'espaces comme absente", () => {
    expect(buildRiskRecord({ ...EMPTY_RISK_FORM, preventive_measure: "   " }).preventive_measure)
      .toBeNull();
  });
});

describe("summarizeRisks", () => {
  it("rend un état neutre sur un registre vide", () => {
    expect(summarizeRisks([], TODAY)).toEqual({
      active: 0,
      overdue: 0,
      byBand: { critique: 0, eleve: 0, modere: 0, faible: 0 },
      unmitigated: 0,
    });
  });

  it("ne compte que les risques actifs", () => {
    // Un risque clôturé documente le passé, il ne pèse plus sur la maîtrise.
    const summary = summarizeRisks(
      [
        risk({ criticality: 16 }),
        risk({ criticality: 16, status: "closed" }),
        risk({ criticality: 2, status: "monitored" }),
      ],
      TODAY,
    );

    expect(summary.active).toBe(2);
    expect(summary.byBand).toEqual({ critique: 1, eleve: 0, modere: 0, faible: 1 });
  });

  it("compte les revues en retard sur les seuls risques actifs", () => {
    const summary = summarizeRisks(
      [
        risk({ review_date: "2026-01-01" }),
        risk({ review_date: "2026-01-01", status: "closed" }),
        risk({ review_date: "2027-01-01" }),
      ],
      TODAY,
    );

    expect(summary.overdue).toBe(1);
  });

  it("compte les risques forts sans mesure préventive", () => {
    const summary = summarizeRisks(
      [
        risk({ criticality: 12, preventive_measure: null }),
        risk({ criticality: 8, preventive_measure: "   " }),
        risk({ criticality: 16, preventive_measure: "Plan B" }),
        // Sous la bande élevée : l'absence de mesure n'appelle pas d'action.
        risk({ criticality: 6, preventive_measure: null }),
        risk({ criticality: 16, preventive_measure: null, status: "closed" }),
      ],
      TODAY,
    );

    expect(summary.unmitigated).toBe(2);
  });
});
