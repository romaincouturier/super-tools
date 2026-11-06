import { describe, it, expect } from "vitest";
import {
  auditPlan,
  buildFacts,
  evaluateIndicator,
  summarize,
  type AuditFacts,
  type AnswerValue,
} from "./auditChecks";
import { APPLICABLE_INDICATORS, findIndicator, gradationOf } from "./auditReferential";

/** Base de faits « tout va bien », que chaque test dégrade sur un point. */
const PERFECT: AuditFacts = {
  activeFormations: 21,
  formationsWithAllDisclosures: 21,
  formationsWithSatisfaction: 7,
  satisfactionMethodAvailable: true,
  sampleSize: 5,
  sampleWithObjectives: 5,
  sampleWithProgramme: 5,
  sampleWithTrainer: 5,
  sampleWithNeedsSurvey: 5,
  sampleWithPrerequisiteCheck: 5,
  sampleWithEvaluations: 5,
  sampleWithConvocation: 5,
  sampleWithTrainerAdequacy: 5,
  reglementInterieurPublished: true,
  vhdProcedureActive: true,
  vhdProcedurePublished: true,
  elearningCourses: 3,
  elearningCoursesWithMandatoryLessons: 3,
  distanceThresholdConfigured: false,
  trainers: 1,
  trainersWithCompetences: 1,
  trainersWithDocuments: 1,
  trainersWithContinuingEducation: 1,
  watchItemsLastYear: 492,
  watchSourcesFollowed: 19,
  watchItemsLinkedToAction: 4,
  handicapReferentDesignated: true,
  handicapPartnersActive: 7,
  coldEvaluationsSubmitted: 12,
  sponsorEvaluationsSubmitted: 3,
  funderAppreciations: 2,
  reclamations: 4,
  reclamationsAcknowledged: 4,
  reclamationsAnswered: 4,
  qualityRisks: 13,
  highRisksWithoutMeasure: 0,
  improvements: 6,
};

const plans = auditPlan();
const planFor = (n: number) => {
  const p = plans.find((x) => x.indicator.number === n);
  if (!p) throw new Error(`plan ${n} introuvable`);
  return p;
};

/** Répond « oui » à toutes les questions d'un indicateur. */
const allYes = (n: number): Record<string, AnswerValue> =>
  Object.fromEntries(planFor(n).questions.map((q) => [q.id, "oui" as AnswerValue]));

describe("périmètre", () => {
  it("retient 22 indicateurs applicables", () => {
    expect(APPLICABLE_INDICATORS).toHaveLength(22);
  });

  it("écarte les indicateurs hors champ en motivant", () => {
    for (const n of [3, 7, 27]) {
      const i = findIndicator(n);
      expect(i?.notApplicable).toBeTruthy();
    }
  });

  it("donne un plan à chaque indicateur applicable", () => {
    expect(plans).toHaveLength(22);
    for (const p of plans) {
      expect(p.checks.length + p.questions.length).toBeGreaterThan(0);
    }
  });
});

describe("gradation", () => {
  // La liste vient du guide. S'en écarter changerait la sévérité d'un verdict.
  it("n'autorise la mineure que sur les indicateurs listés par le guide", () => {
    for (const n of [1, 2, 8, 9, 12, 17, 18, 19, 23, 24, 25, 30]) {
      expect(gradationOf(n)).toBe("mineure_possible");
    }
    for (const n of [4, 5, 6, 10, 11, 21, 22, 26, 31, 32]) {
      expect(gradationOf(n)).toBe("majeure_seule");
    }
  });
});

describe("evaluateIndicator", () => {
  it("rend conforme quand tout passe et que tout est répondu", () => {
    const f = evaluateIndicator(planFor(1), PERFECT, allYes(1));
    expect(f.verdict).toBe("conforme");
    expect(f.pending).toEqual([]);
  });

  // Un audit ne conclut pas sur ce qu'il n'a pas regardé.
  it("suspend le verdict tant qu'une question est sans réponse", () => {
    const f = evaluateIndicator(planFor(1), PERFECT, {});
    expect(f.verdict).toBe("a_verifier");
    expect(f.pending.length).toBe(planFor(1).questions.length);
  });

  it("prononce une mineure sur un respect partiel quand le guide l'autorise", () => {
    const facts = { ...PERFECT, formationsWithAllDisclosures: 11 };
    const f = evaluateIndicator(planFor(1), facts, allYes(1));
    expect(f.verdict).toBe("mineure");
  });

  // L'indicateur 4 n'est pas dans la liste graduée : le même manque partiel y
  // est majeur.
  it("prononce une majeure sur un indicateur non gradué, même partiellement respecté", () => {
    const facts = { ...PERFECT, sampleWithNeedsSurvey: 2 };
    const f = evaluateIndicator(planFor(4), facts, allYes(4));
    expect(f.verdict).toBe("majeure");
  });

  it("prononce une majeure quand rien n'est respecté, même sur un indicateur gradué", () => {
    const facts = {
      ...PERFECT,
      sampleWithConvocation: 0,
      reglementInterieurPublished: false,
    };
    const answers = { "9.referents": "non" as AnswerValue };
    const f = evaluateIndicator(planFor(9), facts, answers);
    expect(f.verdict).toBe("majeure");
  });

  it("compte une réponse « non » comme un défaut", () => {
    const answers = { ...allYes(2), "2.publie": "non" as AnswerValue };
    const f = evaluateIndicator(planFor(2), PERFECT, answers);
    expect(f.verdict).toBe("mineure");
  });

  // Un contrôle sans matière ne doit ni condamner ni absoudre.
  it("ne compte pas un contrôle sans objet", () => {
    const facts = { ...PERFECT, reclamations: 0, reclamationsAcknowledged: 0, reclamationsAnswered: 0 };
    const f = evaluateIndicator(planFor(31), facts, allYes(31));
    expect(f.checks.every((c) => c.status === "unknown")).toBe(true);
    expect(f.verdict).toBe("conforme");
  });

  it("rend le détail chiffré de chaque contrôle", () => {
    const facts = { ...PERFECT, formationsWithAllDisclosures: 11 };
    const f = evaluateIndicator(planFor(1), facts, allYes(1));
    expect(f.checks[0].detail).toBe("11/21 formations complètes");
  });
});

describe("contrôles réels par indicateur", () => {
  it("détecte un registre des risques vide", () => {
    const f = evaluateIndicator(planFor(32), { ...PERFECT, qualityRisks: 0 }, allYes(32));
    expect(f.verdict).toBe("majeure");
    expect(f.checks.find((c) => c.id === "32.risques")?.status).toBe("ko");
  });

  it("détecte un risque élevé sans mesure de prévention", () => {
    const f = evaluateIndicator(planFor(32), { ...PERFECT, highRisksWithoutMeasure: 2 }, allYes(32));
    expect(f.checks.find((c) => c.id === "32.mesures")?.detail).toBe("2 sans mesure");
  });

  it("détecte l'absence de référent handicap", () => {
    const f = evaluateIndicator(
      planFor(26),
      { ...PERFECT, handicapReferentDesignated: false },
      allYes(26),
    );
    expect(f.verdict).toBe("majeure");
  });

  it("détecte une veille captée mais jamais exploitée", () => {
    const f = evaluateIndicator(planFor(23), { ...PERFECT, watchItemsLinkedToAction: 0 }, allYes(23));
    expect(f.verdict).toBe("mineure");
    expect(f.checks.find((c) => c.id === "23.exploitation")?.status).toBe("ko");
  });

  it("détecte une réclamation sans accusé de réception", () => {
    const f = evaluateIndicator(
      planFor(31),
      { ...PERFECT, reclamationsAcknowledged: 1 },
      allYes(31),
    );
    expect(f.verdict).toBe("majeure");
    expect(f.checks.find((c) => c.id === "31.accuse")?.detail).toBe("1/4 réclamations");
  });

  it("détecte un formateur sans justificatif", () => {
    const f = evaluateIndicator(planFor(21), { ...PERFECT, trainersWithDocuments: 0 }, allYes(21));
    expect(f.verdict).toBe("majeure");
  });
});

describe("summarize", () => {
  it("compte les verdicts et signale une majeure comme bloquante", () => {
    const findings = [
      { number: 1, verdict: "conforme" as const, checks: [], pending: [], rationale: "" },
      { number: 4, verdict: "majeure" as const, checks: [], pending: [], rationale: "" },
      { number: 9, verdict: "mineure" as const, checks: [], pending: [], rationale: "" },
      { number: 17, verdict: "a_verifier" as const, checks: [], pending: [], rationale: "" },
    ];
    expect(summarize(findings)).toEqual({
      conforme: 1,
      mineure: 1,
      majeure: 1,
      aVerifier: 1,
      total: 4,
      blocking: true,
    });
  });

  it("ne bloque pas sans majeure", () => {
    expect(summarize([{ number: 1, verdict: "mineure", checks: [], pending: [], rationale: "" }]).blocking).toBe(
      false,
    );
  });
});

describe("buildFacts", () => {
  const RAW = {
    sampleIds: [],
    sampleTrainings: [],
    activeFormations: [],
    submittedEvaluations: [],
    submittedSurveys: [],
    participants: [],
    adequacy: [],
    reglementUrl: null,
    activeVhdProcedures: 0,
    lmsModules: [],
    lmsLessons: [],
    lmsCourseIds: [],
    trainers: [],
    trainerDocumentOwners: [],
    watchItemsLastYear: 0,
    watchSourcesFollowed: 0,
    watchItemsLinkedToAction: 0,
    referentName: null,
    referentEmail: null,
    handicapPartnersActive: 0,
    coldEvaluationsSubmitted: 0,
    sponsorEvaluationsSubmitted: 0,
    funderAppreciations: 0,
    reclamations: [],
    risks: [],
    improvements: 0,
  };

  // Une seule leçon obligatoire quelque part ne rend pas tous les parcours
  // contrôlables : le compte est par cours.
  it("compte les parcours dotés d'une leçon obligatoire, un par un", () => {
    const facts = buildFacts({
      ...RAW,
      lmsCourseIds: ["c1", "c2", "c3"],
      lmsModules: [
        { id: "m1", course_id: "c1" },
        { id: "m2", course_id: "c2" },
        { id: "m3", course_id: "c3" },
      ],
      lmsLessons: [
        { module_id: "m1", is_mandatory: true },
        { module_id: "m2", is_mandatory: false },
        { module_id: "m3", is_mandatory: null },
      ],
    });
    expect(facts.elearningCourses).toBe(3);
    // c1 obligatoire, c3 nul donc obligatoire par convention, c2 facultatif.
    expect(facts.elearningCoursesWithMandatoryLessons).toBe(2);
  });

  it("ne compte aucun parcours quand toutes les leçons sont facultatives", () => {
    const facts = buildFacts({
      ...RAW,
      lmsCourseIds: ["c1"],
      lmsModules: [{ id: "m1", course_id: "c1" }],
      lmsLessons: [{ module_id: "m1", is_mandatory: false }],
    });
    expect(facts.elearningCoursesWithMandatoryLessons).toBe(0);
  });

  it("ignore une leçon rattachée à aucun module", () => {
    const facts = buildFacts({
      ...RAW,
      lmsCourseIds: ["c1"],
      lmsModules: [{ id: "m1", course_id: "c1" }],
      lmsLessons: [{ module_id: null, is_mandatory: true }],
    });
    expect(facts.elearningCoursesWithMandatoryLessons).toBe(0);
  });

  it("n'accorde la désignation du référent qu'avec un nom et une adresse", () => {
    expect(buildFacts({ ...RAW, referentName: "Romain", referentEmail: null }).handicapReferentDesignated).toBe(false);
    expect(buildFacts({ ...RAW, referentName: " ", referentEmail: "r@x.fr" }).handicapReferentDesignated).toBe(false);
    expect(buildFacts({ ...RAW, referentName: "Romain", referentEmail: "r@x.fr" }).handicapReferentDesignated).toBe(true);
  });

  it("ne compte un risque élevé sans mesure que s'il est encore ouvert", () => {
    const facts = buildFacts({
      ...RAW,
      risks: [
        { criticality: 12, preventive_measure: null, status: "open" },
        { criticality: 12, preventive_measure: null, status: "closed" },
        { criticality: 12, preventive_measure: "Mesure", status: "open" },
        { criticality: 4, preventive_measure: null, status: "open" },
      ],
    });
    expect(facts.highRisksWithoutMeasure).toBe(1);
  });
});
