/**
 * Normalisation de l'adresse apprenant (RG-01).
 * Une seule règle, appliquée avant toute recherche, tout envoi et tout
 * enregistrement : minuscules, espaces de bord retirés.
 */
export function normalizeLearnerEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/** Une adresse exploitable : normalisée et pourvue d'un arobase (RG-18). */
export function isUsableLearnerEmail(value: string | null | undefined): boolean {
  const email = normalizeLearnerEmail(value);
  return email.length > 2 && email.includes("@") && !email.startsWith("@") && !email.endsWith("@");
}
