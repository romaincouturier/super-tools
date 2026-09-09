import type { SatisfactionStat } from "./catalogSatisfaction";

/**
 * Texte de diffusion d'un indicateur de résultat, prêt à coller sur une page
 * produit du site.
 *
 * L'indicateur 2 du référentiel demande, depuis le décret 2026-728, que les
 * indicateurs de résultats soient diffusés « en précisant de manière
 * transparente leurs modalités de calcul ». Un taux seul ne suffit donc plus :
 * le texte porte la note, la période, l'effectif et la règle appliquée.
 */

export interface DisclosureInput {
  formationName: string;
  stat: SatisfactionStat;
  /** Année civile des sessions, ou "all" pour le cumul de toutes les années. */
  year: string | "all";
  /** Années réellement couvertes, pour libeller le cumul sans mentir. */
  coveredYears?: string[];
}

/** Libellé de période, tel qu'il sera lu par un visiteur du site. */
export function periodLabel(year: string | "all", coveredYears: string[] = []): string {
  if (year !== "all") return `sessions ${year}`;
  const years = [...coveredYears].sort();
  if (years.length === 0) return "toutes sessions confondues";
  if (years.length === 1) return `sessions ${years[0]}`;
  return `sessions ${years[0]} à ${years[years.length - 1]}`;
}

/** Accord de « avis » et formatage français de la note. */
function ratingSentence(stat: SatisfactionStat): string {
  const note = stat.average.toLocaleString("fr-FR", { minimumFractionDigits: 1 });
  return `${note}/5 sur ${stat.count} avis`;
}

/**
 * Bloc complet à coller. La mention de méthode n'est pas de la décoration :
 * c'est elle qui rend le taux conforme.
 */
export function buildDisclosureText({
  formationName,
  stat,
  year,
  coveredYears = [],
}: DisclosureInput): string {
  return [
    `${formationName} — satisfaction : ${ratingSentence(stat)} (${periodLabel(year, coveredYears)}).`,
    "Méthode de calcul : moyenne des appréciations générales notées de 1 à 5 par " +
      "les participants dans le questionnaire d'évaluation de fin de formation. " +
      "Sont comptées les réponses effectivement soumises et notées ; l'année " +
      "retenue est celle de la session suivie.",
  ].join("\n");
}
