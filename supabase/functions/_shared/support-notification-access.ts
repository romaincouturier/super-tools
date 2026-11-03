/**
 * Règles d'accès de send-support-notification. Un déclarant connecté (staff
 * ou apprenant) peut notifier la création de son ticket ; tout autre envoi
 * (demande d'échange, ticket résolu) est réservé au staff ou à un appel interne.
 * Hors notification à l'admin, le destinataire doit être le déclarant du
 * ticket en base : la fonction ne peut pas servir à écrire à une adresse libre.
 */

const SUBMITTER_TYPES = new Set(["new_ticket", "new_ticket_copy"]);

export function requiresStaff(type: unknown): boolean {
  return !(typeof type === "string" && SUBMITTER_TYPES.has(type));
}

export function sendsToSubmitter(type: unknown): boolean {
  return type !== "new_ticket";
}

export function recipientIsSubmitter(requested: unknown, submitterEmail: string | null | undefined): boolean {
  if (typeof requested !== "string" || !requested.trim() || !submitterEmail) return false;
  return requested.trim().toLowerCase() === submitterEmail.trim().toLowerCase();
}
