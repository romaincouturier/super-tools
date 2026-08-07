export const EXPERTISE_OPTIONS = [
  { value: "facilitation_graphique", label: "Facilitation graphique" },
  { value: "intelligence_collective", label: "Intelligence collective" },
  { value: "agilite", label: "Agilité" },
  { value: "ia", label: "IA" },
  { value: "jeux_outils", label: "Jeux et outils" },
  { value: "ressources_gratuites", label: "Ressources gratuites" },
  { value: "intra_clients", label: "Intra clients" },
] as const;

export const ACCESS_OPTIONS = [
  { value: "gratuit", label: "Gratuit" },
  { value: "payant", label: "Payant" },
  { value: "intra", label: "Intra client" },
] as const;

export const STATUS_OPTIONS = [
  { value: "draft", label: "Brouillon" },
  { value: "published", label: "Publié" },
  { value: "to_review", label: "À vérifier" },
  { value: "archived", label: "Archivé" },
] as const;

export function expertiseLabel(value: string | null | undefined): string | null {
  return EXPERTISE_OPTIONS.find((o) => o.value === value)?.label ?? null;
}

export function accessLabel(value: string | null | undefined): string {
  return ACCESS_OPTIONS.find((o) => o.value === value)?.label ?? "Gratuit";
}

export function statusLabel(value: string | null | undefined): string {
  return STATUS_OPTIONS.find((o) => o.value === value)?.label ?? "Brouillon";
}

/**
 * Périmètre du catalogue (ST-2026-0258). « Catalogue actif » est la vue par
 * défaut : les cours standards du quotidien, sans les intra / clients ni les
 * archivés. « Tout le catalogue » lève l'exclusion des intra.
 */
export const SCOPE_OPTIONS = [
  { value: "active", label: "Catalogue actif" },
  { value: "all", label: "Tout le catalogue" },
] as const;

export interface CourseMetaFilters {
  scope: string; // "active" (défaut) ou "all"
  expertise: string; // "all" ou valeur d'expertise
  access: string; // "all" ou valeur d'accès
  status: string; // "all" ou valeur de statut
}

export const DEFAULT_COURSE_META_FILTERS: CourseMetaFilters = {
  scope: "active",
  expertise: "all",
  access: "all",
  status: "all",
};

interface CourseMetaLike {
  status: string;
  access_type?: string | null;
  expertise?: string | null;
}

/** Un cours est intra/client par son type d'accès ou par son expertise. */
function isIntraCourse(course: CourseMetaLike): boolean {
  return (course.access_type ?? "gratuit") === "intra" || course.expertise === "intra_clients";
}

/**
 * Un cours archivé est masqué par défaut : il ne ressort que via le filtre
 * statut = archived. En périmètre « Catalogue actif », les cours intra /
 * clients sont masqués eux aussi — sauf si l'utilisateur les demande
 * explicitement par le filtre d'accès ou d'expertise, qui reprend la main.
 * Tout le reste (accès, expertise, statut) est piloté par les dropdowns.
 */
export function courseMatchesMetaFilters(course: CourseMetaLike, f: CourseMetaFilters): boolean {
  if (course.status === "archived" && f.status !== "archived") return false;
  if (
    f.scope !== "all" &&
    isIntraCourse(course) &&
    f.access !== "intra" &&
    f.expertise !== "intra_clients"
  ) {
    return false;
  }
  if (f.expertise !== "all" && course.expertise !== f.expertise) return false;
  if (f.access !== "all" && (course.access_type ?? "gratuit") !== f.access) return false;
  if (f.status !== "all" && course.status !== f.status) return false;
  return true;
}
