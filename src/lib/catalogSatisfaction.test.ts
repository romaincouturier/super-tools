import { describe, it, expect } from "vitest";
import {
  computeCatalogSatisfaction,
  availableYears,
  statForYear,
  sessionYear,
  type SatisfactionTrainingInput,
  type SatisfactionEvaluationInput,
} from "./catalogSatisfaction";

const training = (
  id: string,
  catalog_id: string | null,
  start_date: string | null,
  end_date: string | null = null,
): SatisfactionTrainingInput => ({ id, catalog_id, start_date, end_date });

const evaluation = (
  training_id: string | null,
  appreciation_generale: number | null,
  etat = "soumis",
): SatisfactionEvaluationInput => ({ training_id, appreciation_generale, etat });

describe("sessionYear", () => {
  it("retient l'année de fin de session", () => {
    expect(sessionYear(training("t1", "c1", "2025-12-30", "2026-01-02"))).toBe("2026");
  });

  it("retombe sur la date de début quand la session n'a pas de fin", () => {
    expect(sessionYear(training("t1", "c1", "2026-03-10"))).toBe("2026");
  });

  it("ignore une session sans aucune date", () => {
    expect(sessionYear(training("t1", "c1", null))).toBeNull();
  });

  it("ignore une date malformée plutôt que d'inventer une année", () => {
    expect(sessionYear(training("t1", "c1", "à définir"))).toBeNull();
  });
});

describe("computeCatalogSatisfaction", () => {
  it("moyenne les notes par formation et par année", () => {
    const trainings = [
      training("t1", "c1", "2026-01-10", "2026-01-11"),
      training("t2", "c1", "2026-06-01", "2026-06-02"),
      training("t3", "c1", "2025-05-01", "2025-05-02"),
    ];
    const evaluations = [
      evaluation("t1", 5),
      evaluation("t1", 4),
      evaluation("t2", 3),
      evaluation("t3", 4),
    ];

    const result = computeCatalogSatisfaction(trainings, evaluations);

    expect(result.c1.byYear["2026"]).toEqual({ average: 4, count: 3 });
    expect(result.c1.byYear["2025"]).toEqual({ average: 4, count: 1 });
  });

  it("cumule toutes les années sans moyenner des moyennes", () => {
    // 2026 : trois notes à 5 (moyenne 5). 2025 : une note à 1 (moyenne 1).
    // Une moyenne de moyennes donnerait 3 ; le cumul correct donne 4.
    const trainings = [
      training("t1", "c1", "2026-01-10"),
      training("t2", "c1", "2025-01-10"),
    ];
    const evaluations = [
      evaluation("t1", 5),
      evaluation("t1", 5),
      evaluation("t1", 5),
      evaluation("t2", 1),
    ];

    const result = computeCatalogSatisfaction(trainings, evaluations);

    expect(result.c1.overall).toEqual({ average: 4, count: 4 });
  });

  it("arrondit la moyenne au dixième", () => {
    const trainings = [training("t1", "c1", "2026-01-10")];
    const evaluations = [evaluation("t1", 5), evaluation("t1", 4), evaluation("t1", 4)];

    const result = computeCatalogSatisfaction(trainings, evaluations);

    expect(result.c1.byYear["2026"].average).toBe(4.3);
  });

  it("ignore les évaluations non soumises", () => {
    const trainings = [training("t1", "c1", "2026-01-10")];
    const evaluations = [evaluation("t1", 5), evaluation("t1", 1, "envoye")];

    const result = computeCatalogSatisfaction(trainings, evaluations);

    expect(result.c1.byYear["2026"]).toEqual({ average: 5, count: 1 });
  });

  it("ignore une évaluation soumise sans note", () => {
    const trainings = [training("t1", "c1", "2026-01-10")];
    const evaluations = [evaluation("t1", 5), evaluation("t1", null)];

    const result = computeCatalogSatisfaction(trainings, evaluations);

    expect(result.c1.byYear["2026"]).toEqual({ average: 5, count: 1 });
  });

  it("ignore les sessions hors catalogue et les sessions sans date", () => {
    const trainings = [
      training("t1", null, "2026-01-10"),
      training("t2", "c1", null),
    ];
    const evaluations = [evaluation("t1", 5), evaluation("t2", 5)];

    expect(computeCatalogSatisfaction(trainings, evaluations)).toEqual({});
  });

  it("ignore une évaluation rattachée à une session inconnue", () => {
    const trainings = [training("t1", "c1", "2026-01-10")];
    const evaluations = [evaluation("t-supprimee", 5), evaluation(null, 5)];

    expect(computeCatalogSatisfaction(trainings, evaluations)).toEqual({});
  });

  it("sépare deux formations du catalogue", () => {
    const trainings = [
      training("t1", "c1", "2026-01-10"),
      training("t2", "c2", "2026-01-10"),
    ];
    const evaluations = [evaluation("t1", 5), evaluation("t2", 2)];

    const result = computeCatalogSatisfaction(trainings, evaluations);

    expect(result.c1.overall.average).toBe(5);
    expect(result.c2.overall.average).toBe(2);
  });
});

describe("availableYears", () => {
  it("liste les années de session, les plus récentes d'abord, sans doublon", () => {
    const trainings = [
      training("t1", "c1", "2024-01-10"),
      training("t2", "c1", "2026-01-10"),
      training("t3", "c2", "2026-09-10"),
      training("t4", "c2", null),
    ];

    expect(availableYears(trainings)).toEqual(["2026", "2024"]);
  });
});

describe("statForYear", () => {
  const satisfaction = {
    byYear: { "2026": { average: 4.5, count: 10 } },
    overall: { average: 4.2, count: 30 },
  };

  it("rend la statistique de l'année demandée", () => {
    expect(statForYear(satisfaction, "2026")).toEqual({ average: 4.5, count: 10 });
  });

  it("rend le cumul pour « toutes les années »", () => {
    expect(statForYear(satisfaction, "all")).toEqual({ average: 4.2, count: 30 });
  });

  it("rend null pour une année sans réponse", () => {
    expect(statForYear(satisfaction, "2023")).toBeNull();
  });

  it("rend null pour une formation jamais évaluée", () => {
    expect(statForYear(undefined, "2026")).toBeNull();
    expect(statForYear({ byYear: {}, overall: { average: 0, count: 0 } }, "all")).toBeNull();
  });
});
