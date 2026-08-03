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

/**
 * Libellés des codes CPV surveillés. Un code nu ne dit rien au lecteur de la
 * fiche : c'est le libellé qui explique pourquoi l'avis a été retenu.
 */
export const CPV_LABELS: Record<string, string> = {
  "80000000": "Services d'enseignement et de formation",
  "80500000": "Services de formation",
  "80510000": "Services de formation spécialisée",
  "80511000": "Services de formation du personnel",
  "80522000": "Séminaires de formation",
  "80530000": "Services de formation professionnelle",
  "80532000": "Services de formation en gestion",
  "80533100": "Services de formation informatique",
  "80570000": "Services de formation au développement personnel",
  "79400000": "Conseil en affaires et en gestion",
  "79411000": "Conseil en gestion générale",
  "79419000": "Services de conseil en évaluation",
  "79822500": "Services de conception graphique",
  "79951000": "Organisation de séminaires",
  "79952000": "Services d'organisation d'événements",
  "79998000": "Services de coaching",
  "79311300": "Services d'analyse d'enquêtes",
};

/** Rend lisible un élément de `matched_on` : code CPV traduit, mot-clé tel quel. */
export function describeMatch(match: string): string {
  if (!/^\d{6,8}$/.test(match)) return match;
  const label = CPV_LABELS[match];
  return label ? `${label} (CPV ${match})` : `CPV ${match}`;
}
