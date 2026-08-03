/**
 * Calculs partagés de l'écran marchés publics.
 *
 * La date limite est la seule vraie horloge du module : un avis reçu à J-8 qui
 * attend six jours en revue est mort. Elle est fréquemment absente du flux
 * BOAMP, auquel cas l'avis reste à traiter mais ne peut pas être priorisé.
 */

/** Jours restants avant la date limite. Négatif = dépassée, null = inconnue. */
export function daysLeft(deadline: string | null | undefined, now: Date = new Date()): number | null {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
}

/** Seuil au-delà duquel répondre devient difficile, signalé en rouge. */
export const TENDER_URGENT_DAYS = 12;

export function isTenderUrgent(deadline: string | null | undefined, now: Date = new Date()): boolean {
  const left = daysLeft(deadline, now);
  return left !== null && left >= 0 && left <= TENDER_URGENT_DAYS;
}
