import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  isEvaluationSubmitted,
  isNeedsSurveySubmitted,
  recipientsWithoutSubmittedResponse,
} from "./reminder-filters.ts";

Deno.test("sondage : 3 destinataires, 1 a répondu -> rappel aux 2 autres", () => {
  const recipients = [
    { id: "r1", email: "a@x.fr" },
    { id: "r2", email: "b@x.fr" },
    { id: "r3", email: "c@x.fr" },
  ];
  const res = recipientsWithoutSubmittedResponse(recipients, [
    { recipient_id: "r2", respondent_email: "b@x.fr", submitted_at: "2026-09-16T10:00:00Z" },
  ]);
  assertEquals(res.map((r) => r.id), ["r1", "r3"]);
});

Deno.test("sondage : secours par email insensible à la casse si recipient_id vide", () => {
  const recipients = [{ id: "r1", email: "F.Leblanc@x.fr" }, { id: "r2", email: "b@x.fr" }];
  const res = recipientsWithoutSubmittedResponse(recipients, [
    { recipient_id: null, respondent_email: " f.leblanc@X.FR ", submitted_at: "2026-09-16T10:00:00Z" },
  ]);
  assertEquals(res.map((r) => r.id), ["r2"]);
});

Deno.test("sondage : réponse non soumise ne bloque pas le rappel", () => {
  const res = recipientsWithoutSubmittedResponse([{ id: "r1", email: "a@x.fr" }], [
    { recipient_id: "r1", respondent_email: "a@x.fr", submitted_at: null },
  ]);
  assertEquals(res.length, 1);
});

Deno.test("besoins et évaluations : détection des réponses soumises", () => {
  assertEquals(isNeedsSurveySubmitted([{ etat: "accueil_envoye", date_soumission: null }]), false);
  assertEquals(isNeedsSurveySubmitted([{ etat: "envoye", date_soumission: null }, { etat: "complete", date_soumission: null }]), true);
  assertEquals(isEvaluationSubmitted([{ etat: "envoye" }, { etat: "soumis" }]), true);
  assertEquals(isEvaluationSubmitted([{ etat: "envoye", date_soumission: null }]), false);
});
