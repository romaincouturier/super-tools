// Comptage des demandes de devis par formation, pour trier le sélecteur
// « Formation demandée » du micro-devis du plus demandé au moins demandé.

/** Partie formation d'un libellé enregistré « Formation — Formule ». */
export function baseFormationLabel(label: string): string {
  return label.split(" — ")[0].trim();
}

// Mots-outils ignorés pour rapprocher les anciens intitulés du catalogue
// (ex. « Formation en ligne Facilitation graphique (Offre Solo) » du
// catalogue actuel « Formation en ligne à la Facilitation graphique »).
const STOPWORDS = new Set([
  "a", "à", "la", "le", "les", "l", "d", "de", "des", "du",
  "en", "et", "un", "une", "avec",
]);

export function normalizeFormationName(name: string): string {
  const noParens = name.replace(/\([^)]*\)/g, " ");
  const noAccents = noParens.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return noAccents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token && !STOPWORDS.has(token))
    .join(" ");
}

/** Compte les demandes de devis par formation, tous intitulés confondus. */
export function countDevisByFormation(labels: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const raw of labels) {
    if (!raw) continue;
    const key = normalizeFormationName(baseFormationLabel(raw));
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** Tri descendant par nombre de devis, ex æquo dans l'ordre existant. */
export function sortFormationConfigsByDevis<T extends { formation_name: string }>(
  configs: T[],
  demandByFormation: Map<string, number>,
): T[] {
  return configs
    .map((config, index) => ({
      config,
      index,
      count: demandByFormation.get(normalizeFormationName(config.formation_name)) ?? 0,
    }))
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .map((entry) => entry.config);
}
