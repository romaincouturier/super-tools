import { describe, it, expect } from "vitest";
import {
  computeEvaluationStats,
  computeAvgRating,
  computeRecommendationRate,
  buildEvaluationMaps,
  getRecommandationLabel,
  getRecommandationVariant,
  getDelaiApplicationLabel,
  getRythmeLabel,
  getEquilibreLabel,
  getAppreciationsLabel,
  formatEvaluationDisplayName,
  type EvaluationInfo,
} from "./evaluationUtils";

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeEvalInfo = (overrides: Partial<EvaluationInfo> = {}): EvaluationInfo => ({
  evaluationId: "eval-1",
  etat: "soumis",
  date_soumission: "2025-01-15T10:00:00Z",
  appreciation_generale: 4,
  recommandation: "oui",
  fullData: null,
  ...overrides,
});

// ── computeEvaluationStats ───────────────────────────────────────────────────

describe("computeEvaluationStats", () => {
  it("returns zeros for empty map", () => {
    const stats = computeEvaluationStats(new Map(), 5);
    expect(stats).toEqual({
      total: 0,
      soumis: 0,
      envoye: 0,
      nonEnvoye: 5,
      avgRating: 0,
      recommendationRate: 0,
    });
  });

  it("counts submitted, sent, and not-sent correctly", () => {
    const map = new Map<string, EvaluationInfo>([
      ["p1", makeEvalInfo({ etat: "soumis" })],
      ["p2", makeEvalInfo({ etat: "soumis" })],
      ["p3", makeEvalInfo({ etat: "envoye", appreciation_generale: null, recommandation: null })],
    ]);
    const stats = computeEvaluationStats(map, 5);
    expect(stats.total).toBe(3);
    expect(stats.soumis).toBe(2);
    expect(stats.envoye).toBe(1);
    expect(stats.nonEnvoye).toBe(2);
  });

  it("computes average rating only from submitted evaluations with a rating", () => {
    const map = new Map<string, EvaluationInfo>([
      ["p1", makeEvalInfo({ etat: "soumis", appreciation_generale: 5 })],
      ["p2", makeEvalInfo({ etat: "soumis", appreciation_generale: 3 })],
      ["p3", makeEvalInfo({ etat: "soumis", appreciation_generale: null })],
      ["p4", makeEvalInfo({ etat: "envoye", appreciation_generale: 1 })],
    ]);
    const stats = computeEvaluationStats(map, 4);
    expect(stats.avgRating).toBe(4); // (5+3)/2
  });

  it("computes recommendation rate only from submitted evaluations", () => {
    const map = new Map<string, EvaluationInfo>([
      ["p1", makeEvalInfo({ recommandation: "oui_avec_enthousiasme" })],
      ["p2", makeEvalInfo({ recommandation: "oui" })],
      ["p3", makeEvalInfo({ recommandation: "non" })],
      ["p4", makeEvalInfo({ etat: "envoye", recommandation: "oui" })],
    ]);
    const stats = computeEvaluationStats(map, 4);
    // Only p1, p2, p3 are submitted with a recommandation → 2 positive / 3 total = 67%
    expect(stats.recommendationRate).toBe(67);
  });

  it("handles nonEnvoye never going negative", () => {
    const map = new Map<string, EvaluationInfo>([
      ["p1", makeEvalInfo()],
      ["p2", makeEvalInfo()],
      ["p3", makeEvalInfo()],
    ]);
    // More evaluations than participants (edge case)
    const stats = computeEvaluationStats(map, 2);
    expect(stats.nonEnvoye).toBe(0);
  });

  it("handles all evaluations submitted with perfect scores", () => {
    const map = new Map<string, EvaluationInfo>([
      ["p1", makeEvalInfo({ appreciation_generale: 5, recommandation: "oui_avec_enthousiasme" })],
      ["p2", makeEvalInfo({ appreciation_generale: 5, recommandation: "oui" })],
    ]);
    const stats = computeEvaluationStats(map, 2);
    expect(stats.soumis).toBe(2);
    expect(stats.nonEnvoye).toBe(0);
    expect(stats.avgRating).toBe(5);
    expect(stats.recommendationRate).toBe(100);
  });

  it("handles single evaluation with null recommandation", () => {
    const map = new Map<string, EvaluationInfo>([
      ["p1", makeEvalInfo({ recommandation: null })],
    ]);
    const stats = computeEvaluationStats(map, 1);
    expect(stats.recommendationRate).toBe(0);
  });
});

// ── computeAvgRating ─────────────────────────────────────────────────────────

describe("computeAvgRating", () => {
  it("returns 0 for empty array", () => {
    expect(computeAvgRating([])).toBe(0);
  });

  it("returns 0 if all ratings are null", () => {
    expect(computeAvgRating([
      { appreciation_generale: null },
      { appreciation_generale: null },
    ])).toBe(0);
  });

  it("computes average ignoring nulls", () => {
    expect(computeAvgRating([
      { appreciation_generale: 5 },
      { appreciation_generale: 3 },
      { appreciation_generale: null },
    ])).toBe(4);
  });

  it("works with single evaluation", () => {
    expect(computeAvgRating([{ appreciation_generale: 2 }])).toBe(2);
  });
});

// ── computeRecommendationRate ────────────────────────────────────────────────

describe("computeRecommendationRate", () => {
  it("returns 0 for empty array", () => {
    expect(computeRecommendationRate([])).toBe(0);
  });

  it("returns 0 if all recommandations are null", () => {
    expect(computeRecommendationRate([
      { recommandation: null },
      { recommandation: null },
    ])).toBe(0);
  });

  it("computes rate for 100% positive", () => {
    expect(computeRecommendationRate([
      { recommandation: "oui" },
      { recommandation: "oui_avec_enthousiasme" },
    ])).toBe(100);
  });

  it("computes rate for 0% positive", () => {
    expect(computeRecommendationRate([
      { recommandation: "non" },
      { recommandation: "non" },
    ])).toBe(0);
  });

  it("computes mixed rate correctly (rounds)", () => {
    expect(computeRecommendationRate([
      { recommandation: "oui" },
      { recommandation: "non" },
      { recommandation: "non" },
    ])).toBe(33);
  });

  it("ignores null recommandations in denominator", () => {
    // 1 positive out of 1 non-null = 100%
    expect(computeRecommendationRate([
      { recommandation: "oui" },
      { recommandation: null },
    ])).toBe(100);
  });
});

// ── buildEvaluationMaps ──────────────────────────────────────────────────────

describe("buildEvaluationMaps", () => {
  const makeRow = (overrides: Record<string, unknown> = {}) => ({
    id: "ev-1",
    participant_id: "p-1",
    certificate_url: "https://cert.pdf",
    etat: "soumis",
    date_soumission: "2025-01-15T10:00:00Z",
    appreciation_generale: 4,
    recommandation: "oui",
    ...overrides,
  });

  it("builds maps from a single submitted row", () => {
    const { certificateMap, evaluationMap } = buildEvaluationMaps([makeRow()]);
    expect(certificateMap.size).toBe(1);
    expect(certificateMap.get("p-1")).toEqual({
      evaluationId: "ev-1",
      certificateUrl: "https://cert.pdf",
    });
    expect(evaluationMap.size).toBe(1);
    const evalInfo = evaluationMap.get("p-1")!;
    expect(evalInfo.etat).toBe("soumis");
    expect(evalInfo.fullData).not.toBeNull();
  });

  it("sets fullData to null for non-submitted evaluations", () => {
    const { certificateMap, evaluationMap } = buildEvaluationMaps([
      makeRow({ etat: "envoye" }),
    ]);
    expect(certificateMap.size).toBe(0);
    expect(evaluationMap.get("p-1")!.fullData).toBeNull();
  });

  it("skips rows without participant_id", () => {
    const { certificateMap, evaluationMap } = buildEvaluationMaps([
      makeRow({ participant_id: null }),
    ]);
    expect(certificateMap.size).toBe(0);
    expect(evaluationMap.size).toBe(0);
  });

  it("handles multiple participants", () => {
    const { certificateMap, evaluationMap } = buildEvaluationMaps([
      makeRow({ id: "ev-1", participant_id: "p-1", etat: "soumis" }),
      makeRow({ id: "ev-2", participant_id: "p-2", etat: "envoye", certificate_url: null }),
      makeRow({ id: "ev-3", participant_id: "p-3", etat: "soumis", certificate_url: null }),
    ]);
    expect(certificateMap.size).toBe(2); // p-1, p-3
    expect(evaluationMap.size).toBe(3);
    expect(certificateMap.get("p-2")).toBeUndefined();
    expect(certificateMap.get("p-3")!.certificateUrl).toBeNull();
  });

  it("last row wins when duplicate participant_ids exist", () => {
    const { evaluationMap } = buildEvaluationMaps([
      makeRow({ id: "ev-old", participant_id: "p-1", etat: "envoye" }),
      makeRow({ id: "ev-new", participant_id: "p-1", etat: "soumis" }),
    ]);
    expect(evaluationMap.get("p-1")!.evaluationId).toBe("ev-new");
    expect(evaluationMap.get("p-1")!.etat).toBe("soumis");
  });
});

// ── Label helpers ────────────────────────────────────────────────────────────

describe("getRecommandationLabel", () => {
  it("returns null for null input", () => {
    expect(getRecommandationLabel(null)).toBeNull();
  });

  it("maps known values", () => {
    expect(getRecommandationLabel("oui_avec_enthousiasme")).toBe("Recommande vivement");
    expect(getRecommandationLabel("oui")).toBe("Recommande");
    expect(getRecommandationLabel("non")).toBe("Ne recommande pas");
  });

  it("returns raw value for unknown input", () => {
    expect(getRecommandationLabel("peut_etre")).toBe("peut_etre");
  });
});

describe("getRecommandationVariant", () => {
  it("returns secondary for null", () => {
    expect(getRecommandationVariant(null)).toBe("secondary");
  });

  it("maps known values", () => {
    expect(getRecommandationVariant("oui_avec_enthousiasme")).toBe("default");
    expect(getRecommandationVariant("oui")).toBe("secondary");
    expect(getRecommandationVariant("non")).toBe("destructive");
  });

  it("returns secondary for unknown input", () => {
    expect(getRecommandationVariant("unknown")).toBe("secondary");
  });
});

describe("getDelaiApplicationLabel", () => {
  it("returns null for null input", () => {
    expect(getDelaiApplicationLabel(null)).toBeNull();
  });

  it("maps known values", () => {
    expect(getDelaiApplicationLabel("cette_semaine")).toBe("Cette semaine");
    expect(getDelaiApplicationLabel("ce_mois")).toBe("Ce mois-ci");
    expect(getDelaiApplicationLabel("3_mois")).toBe("Dans les 3 mois");
  });

  it("returns 'Application incertaine' for unknown input", () => {
    expect(getDelaiApplicationLabel("jamais")).toBe("Application incertaine");
  });
});

describe("getRythmeLabel", () => {
  it("returns null for null input", () => {
    expect(getRythmeLabel(null)).toBeNull();
  });

  it("maps known values", () => {
    expect(getRythmeLabel("trop_lent")).toBe("Trop lent");
    expect(getRythmeLabel("adapte")).toBe("Adapté");
    expect(getRythmeLabel("trop_rapide")).toBe("Trop rapide");
  });

  it("returns raw value for unknown input", () => {
    expect(getRythmeLabel("variable")).toBe("variable");
  });
});

describe("getEquilibreLabel", () => {
  it("returns null for null input", () => {
    expect(getEquilibreLabel(null)).toBeNull();
  });

  it("maps known values", () => {
    expect(getEquilibreLabel("trop_theorique")).toBe("Trop théorique");
    expect(getEquilibreLabel("equilibre")).toBe("Équilibré");
    expect(getEquilibreLabel("pas_assez_structure")).toBe("Pas assez structuré");
  });

  it("returns raw value for unknown input", () => {
    expect(getEquilibreLabel("autre")).toBe("autre");
  });
});

describe("getAppreciationsLabel", () => {
  it("returns null for null input", () => {
    expect(getAppreciationsLabel(null)).toBeNull();
  });

  it("maps known values", () => {
    expect(getAppreciationsLabel("oui")).toBe("Oui");
    expect(getAppreciationsLabel("non")).toBe("Non");
    expect(getAppreciationsLabel("sans_objet")).toBe("Sans objet");
  });

  it("returns raw value for unknown input", () => {
    expect(getAppreciationsLabel("partiellement")).toBe("partiellement");
  });
});

describe("formatEvaluationDisplayName", () => {
  it("returns 'Anonyme' when both names are null", () => {
    expect(formatEvaluationDisplayName(null, null)).toBe("Anonyme");
  });

  it("returns first name only", () => {
    expect(formatEvaluationDisplayName("Jean", null)).toBe("Jean");
  });

  it("returns last name only", () => {
    expect(formatEvaluationDisplayName(null, "Dupont")).toBe("Dupont");
  });

  it("returns full name trimmed", () => {
    expect(formatEvaluationDisplayName("Jean", "Dupont")).toBe("Jean Dupont");
  });

  it("treats empty strings as absent", () => {
    expect(formatEvaluationDisplayName("", "")).toBe("Anonyme");
  });
});
