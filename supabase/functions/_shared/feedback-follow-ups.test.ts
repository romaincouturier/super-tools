import { it, expect } from "vitest";
import { buildFollowUpActions, COLD_NEED_LABELS } from "./feedback-follow-ups.ts";
import { BESOINS } from "../../../src/lib/coldEvaluationOptions.ts";

it("COLD_NEED_LABELS reste aligné sur BESOINS du questionnaire (hors « aucun »)", () => {
  const front = Object.fromEntries(BESOINS.filter((b) => b.value !== "aucun").map((b) => [b.value, b.label]));
  expect(COLD_NEED_LABELS).toEqual(front);
});

it("une action par questionnaire à froid avec un besoin réel, et par retour libre avec une suite", () => {
  const actions = buildFollowUpActions(
    [
      { id: "c1", training_id: "t1", first_name: "Anne", last_name: "Martin", email: "a@x.fr", besoins_complementaires: ["acces_elearning", "aucun"], trainings: { training_name: "Sketchnote" } },
      { id: "c2", training_id: "t1", first_name: null, last_name: null, email: "b@x.fr", besoins_complementaires: ["aucun"] },
      { id: "c3", training_id: "t1", first_name: null, last_name: null, email: null, besoins_complementaires: null },
    ],
    [
      { id: "f1", training_id: "t2", author_name: "Paul", follow_up: " Relancer l'accès e-learning ", trainings: { training_name: "Facilitation" } },
      { id: "f2", training_id: "t2", author_name: "Zoé", follow_up: "  " },
    ],
    "https://app",
  );
  expect(actions).toEqual([
    {
      category: "suites_retours", title: "Anne Martin — Sketchnote", description: "Demande après la formation : Revoir le parcours en ligne",
      link: "https://app/formations/t1", entityType: "participant_cold_evaluation", entityId: "c1", scope: "global",
    },
    {
      category: "suites_retours", title: "Paul — Facilitation", description: "Relancer l'accès e-learning",
      link: "https://app/formations/t2", entityType: "training_feedback", entityId: "f1", scope: "global",
    },
  ]);
});
