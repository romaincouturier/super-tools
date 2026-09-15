/**
 * Règles de durée des liens apprenant (RG-06 de la spécification de connexion).
 * Un lien de connexion vaut 30 minutes, un lien d'activation 7 jours, tous à
 * usage unique. La règle vit ici pour être vérifiable, et non recopiée dans
 * chaque fonction qui émet un lien.
 */
export type LinkPurpose = "login" | "activation";

export const LINK_TTL_MINUTES: Record<LinkPurpose, number> = {
  login: 30,
  activation: 7 * 24 * 60,
};

/** Date d'expiration d'un lien, à partir d'un instant de référence. */
export function linkExpiresAt(purpose: string | undefined, now: Date = new Date()): Date {
  const resolved: LinkPurpose = purpose === "login" ? "login" : "activation";
  return new Date(now.getTime() + LINK_TTL_MINUTES[resolved] * 60_000);
}

/** Phrase annonçant la durée dans l'email (RG-15). */
export function linkValidityLabel(purpose: string | undefined): string {
  return purpose === "login"
    ? "Ce lien est valable 30 minutes et ne fonctionne qu'une fois."
    : "Ce lien est valable 7 jours et ne fonctionne qu'une fois.";
}
