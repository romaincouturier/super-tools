/**
 * Accusé de réception d'une réclamation (indicateur 31).
 *
 * Le référentiel attend, comme première preuve du traitement des réclamations,
 * l'accusé de réception adressé au réclamant. Ce fichier ne décide pas du
 * texte : il dit seulement si une réclamation donnée est en état d'en recevoir
 * un, et pourquoi pas le cas échéant.
 */

export interface AcknowledgeableReclamation {
  status?: string | null;
  client_email?: string | null;
  acknowledgement_sent_at?: string | null;
}

/** Raison pour laquelle l'accusé n'est pas envoyé, ou null s'il peut l'être. */
export type AcknowledgementBlocker = "not_submitted" | "no_email" | "already_sent" | null;

const isBlank = (v: string | null | undefined) =>
  typeof v !== "string" || v.trim().length === 0;

export function acknowledgementBlocker(r: AcknowledgeableReclamation): AcknowledgementBlocker {
  // Une réclamation en brouillon n'a pas été soumise : le lien a été créé mais
  // le formulaire n'est pas revenu. Accuser réception serait accuser du vide.
  if (r.status === "draft") return "not_submitted";
  if (isBlank(r.client_email)) return "no_email";
  if (!isBlank(r.acknowledgement_sent_at)) return "already_sent";
  return null;
}

export function canAcknowledge(r: AcknowledgeableReclamation): boolean {
  return acknowledgementBlocker(r) === null;
}

/** Message rendu à l'appelant, pour qu'un renvoi manuel sache ce qui bloque. */
export function blockerMessage(blocker: AcknowledgementBlocker): string {
  switch (blocker) {
    case "not_submitted":
      return "Réclamation encore en brouillon";
    case "no_email":
      return "Aucune adresse de réclamant enregistrée";
    case "already_sent":
      return "Accusé de réception déjà envoyé";
    default:
      return "";
  }
}
