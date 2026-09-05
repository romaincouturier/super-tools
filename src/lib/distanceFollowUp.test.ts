import { describe, it, expect } from "vitest";
import {
  computeFollowUp,
  summarizeFollowUp,
  FOLLOW_UP_LABELS,
  type LearnerActivity,
} from "./distanceFollowUp";

const TODAY = "2026-09-04";
const LESSONS = ["l1", "l2", "l3"];

const activity = (over: Partial<LearnerActivity> = {}): LearnerActivity => ({
  learnerEmail: "apprenant@example.com",
  progress: [],
  views: [],
  quizAttempts: [],
  submittedWork: [],
  ...over,
});

const done = (lesson: string, date: string) => ({
  lesson_id: lesson,
  status: "completed",
  completed_at: date,
});

describe("computeFollowUp", () => {
  it("déclare non commencé un apprenant sans aucune trace", () => {
    const result = computeFollowUp(activity(), LESSONS, TODAY);

    expect(result.status).toBe("non_commence");
    expect(result.reasons[0]).toContain("Aucun module ouvert");
  });

  it("déclare conforme un parcours terminé avec des activités rendues", () => {
    const result = computeFollowUp(
      activity({
        progress: [done("l1", "2026-09-01"), done("l2", "2026-09-02"), done("l3", "2026-09-03")],
        quizAttempts: [{ quiz_id: "q1", passed: true, completed_at: "2026-09-03" }],
        submittedWork: [{ lesson_id: "l3", created_at: "2026-09-03" }],
      }),
      LESSONS,
      TODAY,
    );

    expect(result.status).toBe("suivi_conforme");
    expect(result.completed).toBe(3);
    expect(result.activities).toBe(2);
    expect(result.reasons.join(" ")).toContain("3/3 modules obligatoires terminés");
  });

  it("refuse de déclarer conforme un parcours coché sans aucune activité rendue", () => {
    // Tout cocher ne prouve pas un apprentissage : c'est précisément ce que
    // l'indicateur 19 demande de vérifier.
    const result = computeFollowUp(
      activity({
        progress: [done("l1", "2026-09-01"), done("l2", "2026-09-02"), done("l3", "2026-09-03")],
      }),
      LESSONS,
      TODAY,
    );

    expect(result.status).toBe("incomplet");
    expect(result.reasons[0]).toContain("aucune activité rendue");
  });

  it("compte une leçon terminée comme ouverte même sans vue tracée", () => {
    const result = computeFollowUp(
      activity({ progress: [done("l1", "2026-09-01")] }),
      LESSONS,
      TODAY,
    );

    expect(result.opened).toBe(1);
  });

  it("ignore les leçons hors du parcours obligatoire", () => {
    const result = computeFollowUp(
      activity({
        progress: [done("hors-parcours", "2026-09-01")],
        views: [{ lesson_id: "hors-parcours" }],
      }),
      LESSONS,
      TODAY,
    );

    expect(result.completed).toBe(0);
    expect(result.opened).toBe(0);
  });

  it("réclame une relance après le délai d'inactivité", () => {
    const result = computeFollowUp(
      activity({
        progress: [done("l1", "2026-07-01")],
        views: [{ lesson_id: "l2" }],
      }),
      LESSONS,
      TODAY,
      21,
    );

    expect(result.status).toBe("a_relancer");
    expect(result.reasons[0]).toContain("Aucune activité depuis");
  });

  it("respecte le délai d'inactivité passé par l'appelant", () => {
    const recent = activity({ progress: [done("l1", "2026-08-25")] });

    expect(computeFollowUp(recent, LESSONS, TODAY, 21).status).toBe("en_cours");
    expect(computeFollowUp(recent, LESSONS, TODAY, 5).status).toBe("a_relancer");
  });

  it("réclame une relance quand des modules sont ouverts sans rien rendre", () => {
    const result = computeFollowUp(
      activity({ views: [{ lesson_id: "l1" }, { lesson_id: "l2" }] }),
      LESSONS,
      TODAY,
    );

    expect(result.status).toBe("a_relancer");
    expect(result.reasons[0]).toContain("aucune activité rendue à ce jour");
  });

  it("suit un parcours entamé et actif", () => {
    const result = computeFollowUp(
      activity({
        progress: [done("l1", "2026-09-02")],
        views: [{ lesson_id: "l2" }],
        quizAttempts: [{ quiz_id: "q1", passed: true, completed_at: "2026-09-03" }],
      }),
      LESSONS,
      TODAY,
    );

    expect(result.status).toBe("en_cours");
    expect(result.reasons).toHaveLength(2);
    expect(result.reasons[1]).toContain("1 activité rendue");
  });

  it("accorde le pluriel au-delà d'une activité", () => {
    const result = computeFollowUp(
      activity({
        progress: [done("l1", "2026-09-02")],
        quizAttempts: [{ quiz_id: "q1", passed: true, completed_at: "2026-09-03" }],
        submittedWork: [{ lesson_id: "l2", created_at: "2026-09-03" }],
      }),
      LESSONS,
      TODAY,
    );

    expect(result.status).toBe("en_cours");
    expect(result.reasons[1]).toContain("2 activités rendues");
  });

  it("ne compte pas un quiz échoué comme une activité rendue", () => {
    const result = computeFollowUp(
      activity({
        progress: [done("l1", "2026-09-01"), done("l2", "2026-09-02"), done("l3", "2026-09-03")],
        quizAttempts: [{ quiz_id: "q1", passed: false, completed_at: "2026-09-03" }],
      }),
      LESSONS,
      TODAY,
    );

    expect(result.activities).toBe(0);
    expect(result.status).toBe("incomplet");
  });

  it("retient la dernière activité, pas la première", () => {
    const result = computeFollowUp(
      activity({
        progress: [done("l1", "2026-08-01")],
        submittedWork: [{ lesson_id: "l2", created_at: "2026-09-02" }],
      }),
      LESSONS,
      TODAY,
    );

    expect(result.lastActivityAt).toBe("2026-09-02");
  });

  it("ne déclare jamais conforme un parcours sans leçon obligatoire", () => {
    // Sans attendu, il n'y a rien à vérifier : affirmer la conformité serait
    // une affirmation sans preuve.
    const result = computeFollowUp(
      activity({ submittedWork: [{ lesson_id: "l1", created_at: "2026-09-03" }] }),
      [],
      TODAY,
    );

    expect(result.status).not.toBe("suivi_conforme");
  });

  it("accorde les libellés au singulier sur un parcours d'une seule leçon", () => {
    const incomplet = computeFollowUp(
      activity({ progress: [done("l1", "2026-09-03")] }),
      ["l1"],
      TODAY,
    );
    expect(incomplet.status).toBe("incomplet");
    expect(incomplet.reasons[0]).toContain("1 module terminé, mais aucune activité rendue");

    const relance = computeFollowUp(activity({ views: [{ lesson_id: "l1" }] }), ["l1"], TODAY);
    expect(relance.reasons[0]).toContain("1 module ouvert, aucune activité rendue");

    const enCours = computeFollowUp(
      activity({
        progress: [done("l1", "2026-09-03")],
        submittedWork: [{ lesson_id: "l1", created_at: "2026-09-03" }],
      }),
      LESSONS,
      TODAY,
    );
    expect(enCours.reasons[1]).toContain("1 activité rendue");

    const conforme = computeFollowUp(
      activity({
        progress: [done("l1", "2026-09-03")],
        submittedWork: [{ lesson_id: "l1", created_at: "2026-09-03" }],
      }),
      ["l1"],
      TODAY,
    );
    expect(conforme.status).toBe("suivi_conforme");
    expect(conforme.reasons[1]).toContain("1 activité rendue");
  });

  it("ignore une date d'activité illisible sans planter", () => {
    const result = computeFollowUp(
      activity({ progress: [{ lesson_id: "l1", status: "completed", completed_at: "jamais" }] }),
      LESSONS,
      TODAY,
    );

    expect(result.status).toBe("en_cours");
  });
});

describe("summarizeFollowUp", () => {
  it("répartit les apprenants par statut", () => {
    const results = [
      computeFollowUp(activity(), LESSONS, TODAY),
      computeFollowUp(activity(), LESSONS, TODAY),
      computeFollowUp(
        activity({
          progress: LESSONS.map((l) => done(l, "2026-09-03")),
          submittedWork: [{ lesson_id: "l1", created_at: "2026-09-03" }],
        }),
        LESSONS,
        TODAY,
      ),
    ];

    expect(summarizeFollowUp(results)).toEqual({
      non_commence: 2,
      en_cours: 0,
      suivi_conforme: 1,
      a_relancer: 0,
      incomplet: 0,
    });
  });

  it("expose un libellé lisible pour chaque statut", () => {
    expect(Object.keys(FOLLOW_UP_LABELS)).toHaveLength(5);
    expect(FOLLOW_UP_LABELS.a_relancer).toBe("À relancer");
  });
});
