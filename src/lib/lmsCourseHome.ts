import type { CourseHomeConfig } from "@/hooks/useLmsQueries";

/**
 * Réglages d'affichage de la page d'accueil d'une formation.
 * Chaque helper part du principe qu'un réglage absent ou vide rend
 * exactement le comportement historique : une formation non modifiée doit
 * être strictement inchangée.
 */

export const DEFAULT_CTA_LABEL_START = "Commencer la formation";
export const DEFAULT_CTA_LABEL_RESUME = "Continuer la formation";
/** Le bouton ne doit pas passer sur deux lignes. */
export const CTA_LABEL_MAX_LENGTH = 40;

/**
 * Libellé du bouton principal de l'accueil (ST-2026-0259). La variante de
 * reprise s'applique dès que la progression a démarré.
 */
export function homeCtaLabel(
  config: CourseHomeConfig | null | undefined,
  completionPct: number,
): string {
  const started = completionPct > 0;
  const custom = started ? config?.cta_label_resume : config?.cta_label_start;
  return custom?.trim() || (started ? DEFAULT_CTA_LABEL_RESUME : DEFAULT_CTA_LABEL_START);
}

export type ProgressDisplayMode = "auto" | "always" | "never";

export const PROGRESS_DISPLAY_OPTIONS: { value: ProgressDisplayMode; label: string; hint: string }[] = [
  { value: "auto", label: "Automatique", hint: "Masqué si la formation ne compte qu'une seule séquence" },
  { value: "always", label: "Toujours affiché", hint: "Même sur une séquence unique" },
  { value: "never", label: "Jamais affiché", hint: "Le suivi de complétion continue d'être enregistré" },
];

/**
 * Affichage des indicateurs de progression de l'accueil (ST-2026-0260) :
 * anneau « Votre progression » et compteur de la barre latérale. Purement
 * visuel — la complétion continue d'être enregistrée et reste visible dans
 * les statistiques formateur.
 *
 * En mode automatique (défaut), la progression disparaît quand il n'y a rien
 * à suivre : une séquence au total, ou aucune.
 */
export function shouldShowProgress(
  config: CourseHomeConfig | null | undefined,
  totalSequences: number,
): boolean {
  const mode = config?.progress_display ?? "auto";
  if (mode === "always") return true;
  if (mode === "never") return false;
  return totalSequences > 1;
}
