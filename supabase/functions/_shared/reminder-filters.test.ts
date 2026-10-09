import { it, expect } from "vitest";
import {
  isEvaluationSubmitted,
  isNeedsSurveySubmitted,
  recipientsWithoutSubmittedResponse,
} from "./reminder-filters.ts";

it("sondage : 3 destinataires, 1 a répondu -> rappel aux 2 autres", () => {
  const recipients = [
    { id: "r1", email: "a@x.fr" },
    { id: "r2", email: "b@x.fr" },
    { id: "r3", email: "c@x.fr" },
  ];
  const res = recipientsWithoutSubmittedResponse(recipients, [
    { recipient_id: "r2", respondent_email: "b@x.fr", submitted_at: "2026-09-16T10:00:00Z" },
  ]);
  expect(res.map((r) => r.id)).toEqual(["r1", "r3"]);
});

it("sondage : secours par email insensible à la casse si recipient_id vide", () => {
  const recipients = [{ id: "r1", email: "F.Leblanc@x.fr" }, { id: "r2", email: "b@x.fr" }];
  const res = recipientsWithoutSubmittedResponse(recipients, [
    { recipient_id: null, respondent_email: " f.leblanc@X.FR ", submitted_at: "2026-09-16T10:00:00Z" },
  ]);
  expect(res.map((r) => r.id)).toEqual(["r2"]);
});

it("sondage : réponse non soumise ne bloque pas le rappel", () => {
  const res = recipientsWithoutSubmittedResponse([{ id: "r1", email: "a@x.fr" }], [
    { recipient_id: "r1", respondent_email: "a@x.fr", submitted_at: null },
  ]);
  expect(res.length).toEqual(1);
});

it("besoins et évaluations : détection des réponses soumises", () => {
  expect(isNeedsSurveySubmitted([{ etat: "accueil_envoye", date_soumission: null }])).toEqual(false);
  expect(isNeedsSurveySubmitted([{ etat: "envoye", date_soumission: null }, { etat: "complete", date_soumission: null }])).toEqual(true);
  expect(isEvaluationSubmitted([{ etat: "envoye" }, { etat: "soumis" }])).toEqual(true);
  expect(isEvaluationSubmitted([{ etat: "envoye", date_soumission: null }])).toEqual(false);
});
