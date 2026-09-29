/**
 * Filtres anti-relance : un rappel ne part qu'aux destinataires sans réponse soumise.
 */

export interface SurveyRecipientLike {
  id: string;
  email: string | null;
}

export interface SurveyResponseLike {
  recipient_id: string | null;
  respondent_email: string | null;
  submitted_at: string | null;
}

const norm = (e: string | null | undefined) => (e ?? "").trim().toLowerCase();

/** Destinataires d'un sondage n'ayant pas de réponse soumise (par recipient_id, sinon par email). */
export function recipientsWithoutSubmittedResponse<T extends SurveyRecipientLike>(
  recipients: T[],
  responses: SurveyResponseLike[],
): T[] {
  const submitted = responses.filter((r) => r.submitted_at);
  const ids = new Set(submitted.map((r) => r.recipient_id).filter(Boolean) as string[]);
  const emails = new Set(submitted.map((r) => norm(r.respondent_email)).filter(Boolean));
  return recipients.filter((r) => !ids.has(r.id) && !(norm(r.email) && emails.has(norm(r.email))));
}

/** Questionnaire de besoins soumis : date_soumission renseignée ou etat « complete ». */
export function isNeedsSurveySubmitted(rows: { etat: string | null; date_soumission: string | null }[]): boolean {
  return rows.some((r) => !!r.date_soumission || r.etat === "complete");
}

/** Évaluation soumise : etat « soumis » ou date_soumission renseignée. */
export function isEvaluationSubmitted(rows: { etat: string | null; date_soumission?: string | null }[]): boolean {
  return rows.some((r) => r.etat === "soumis" || !!r.date_soumission);
}
