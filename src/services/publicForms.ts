import { supabase } from "@/integrations/supabase/client";

/**
 * Appels edge des formulaires publics (questionnaire besoins, évaluation).
 * Regroupés ici (règle [020]) : les hooks ne font pas d'invoke inline.
 * Tous ces appels sont des effets de bord non bloquants pour l'utilisateur —
 * la gestion d'erreur (report Sentry, console) reste chez l'appelant.
 */

export interface FormErrorAlert {
  formType: "besoins" | "evaluation";
  token: string | undefined;
  errorMessage: string;
  userAgent: string;
  url: string;
  attempt?: number;
}

export function alertFormError(body: FormErrorAlert) {
  return supabase.functions.invoke("alert-form-error", { body: { ...body } });
}

export function processEvaluationSubmission(evaluationId: string) {
  return supabase.functions.invoke("process-evaluation-submission", { body: { evaluationId } });
}

export function sendQuestionnaireConfirmation(body: {
  questionnaireId: string;
  trainingId: string;
  participantEmail: string | null;
  participantFirstName: string;
  formatFormation: string | null | undefined;
}) {
  return supabase.functions.invoke("send-questionnaire-confirmation", { body });
}

export function sendPrerequisWarning(body: {
  questionnaireId: string;
  participantEmail: string | null;
  participantName: string;
  trainingName: string;
  prerequisValidations: Record<string, string>;
}) {
  return supabase.functions.invoke("send-prerequis-warning", { body });
}

export function sendAccessibilityNeeds(body: {
  questionnaireId: string;
  trainingId: string;
  participantEmail: string | null;
  participantFirstName: string;
  accessibilityNeeds: string;
  trainingName: string;
}) {
  return supabase.functions.invoke("send-accessibility-needs", { body });
}
