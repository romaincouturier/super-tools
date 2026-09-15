/**
 * Routage d'authentification (lot 2, chapitre 7 de la spécification).
 * Une seule source pour la destination mémorisée et pour la destination finale.
 */

export const LEARNER_HOME = "/espace-apprenant/tableau-de-bord";
export const STAFF_HOME = "/dashboard";

/** Nom du paramètre portant la destination à rejoindre après connexion. */
export const REDIRECT_PARAM = "next";

/**
 * Une destination mémorisée n'est acceptée que si elle est interne (RG-10).
 * Toute valeur absolue, protocole-relative ou vide est ignorée.
 */
export function sanitizeRedirect(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.startsWith("/connexion") || value === "/auth") return null;
  return value;
}

/** Construit l'URL de la porte de connexion en mémorisant la destination. */
export function buildLoginPath(gate: string, from: string): string {
  const next = sanitizeRedirect(from);
  return next ? `${gate}?${REDIRECT_PARAM}=${encodeURIComponent(next)}` : gate;
}

/**
 * Destination après authentification, selon la table du chapitre 7.
 * Un apprenant n'est jamais renvoyé sur une route back-office.
 */
export const NO_ACCESS_HOME = "/compte-sans-acces";

export function resolvePostLoginPath(params: {
  isStaff: boolean;
  mustChangePassword: boolean;
  next?: string | null;
  hasAccess?: boolean;
}): string {
  const { isStaff, mustChangePassword } = params;
  if (mustChangePassword) return "/force-password-change";
  // Compte authentifié sans rattachement : état terminal explicite (critère 13).
  if (params.hasAccess === false) return NO_ACCESS_HOME;
  const next = sanitizeRedirect(params.next);
  if (next) {
    const targetsLearnerSpace = next.startsWith("/espace-apprenant") || next.startsWith("/lms/");
    if (isStaff || targetsLearnerSpace) return next;
  }
  return isStaff ? STAFF_HOME : LEARNER_HOME;
}
