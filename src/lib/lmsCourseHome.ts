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

/**
 * Classes de grille du tableau de bord de l'accueil (ST-2026-0255). Le
 * nombre de colonnes suit le nombre d'encadrés réellement affichés, pour ne
 * jamais réserver d'espace vide. Les classes sont écrites en toutes lettres :
 * Tailwind ne génère que ce qu'il lit dans les sources.
 */
export function homeDashboardGridClass(visibleBlocks: number): string {
  if (visibleBlocks >= 4) return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5";
  if (visibleBlocks === 3) return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5";
  if (visibleBlocks === 2) return "grid grid-cols-1 sm:grid-cols-2 gap-5";
  // Un seul encadré : largeur confortable, sans s'étaler sur toute la page.
  return "grid grid-cols-1 gap-5 sm:max-w-md";
}

export type IntroBoxType = "tips" | "thread" | "explore" | "none";

/**
 * Encadré d'introduction de l'accueil (ST-2026-0254). « tips » est la valeur
 * historique : une formation non modifiée garde l'encadré « Conseils pour
 * bien démarrer » à l'identique.
 */
export const INTRO_BOX_OPTIONS: { value: IntroBoxType; label: string; defaultTitle: string | null }[] = [
  { value: "tips", label: "Conseils pour bien démarrer", defaultTitle: "Conseils pour bien démarrer" },
  { value: "thread", label: "Votre fil rouge", defaultTitle: "Votre fil rouge" },
  { value: "explore", label: "Ce que vous allez explorer", defaultTitle: "Ce que vous allez explorer" },
  { value: "none", label: "Aucun encadré", defaultTitle: null },
];

/** Conseils affichés quand une formation n'en a saisi aucun (comportement historique). */
export const DEFAULT_TIPS = [
  "Ayez toujours une feuille et un feutre à portée de main.",
  "Progressez petit à petit, l'essentiel est la régularité.",
  "Testez, osez, pratiquez : il n'y a pas de dessin parfait.",
  "Participez aux lives et posez vos questions.",
];

export function introBoxDefaultTitle(type: IntroBoxType): string | null {
  return INTRO_BOX_OPTIONS.find((o) => o.value === type)?.defaultTitle ?? null;
}

/**
 * Titre et lignes de l'encadré d'introduction, ou null quand il ne doit pas
 * s'afficher : type « Aucun encadré », ou type autre que « Conseils » sans
 * contenu saisi (les conseils, eux, gardent leur liste par défaut).
 */
export function resolveIntroBox(
  config: CourseHomeConfig | null | undefined,
): { title: string; items: string[] } | null {
  const type = config?.intro_box_type ?? "tips";
  if (type === "none") return null;
  const saved = (config?.tips ?? []).map((t) => t.trim()).filter(Boolean);
  const items = saved.length > 0 ? saved : type === "tips" ? DEFAULT_TIPS : [];
  if (items.length === 0) return null;
  return { title: config?.intro_box_title?.trim() || introBoxDefaultTitle(type) || "", items };
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
