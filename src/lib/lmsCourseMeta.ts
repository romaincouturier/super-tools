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

export type CourseQuickView =
  | "tous"
  | "publies"
  | "brouillons"
  | "a_verifier"
  | "gratuits"
  | "payants"
  | "intra"
  | "archives";

export const QUICK_VIEWS: { key: CourseQuickView; label: string }[] = [
  { key: "tous", label: "Tous" },
  { key: "publies", label: "Publiés" },
  { key: "brouillons", label: "Brouillons" },
  { key: "a_verifier", label: "À vérifier" },
  { key: "gratuits", label: "Gratuits" },
  { key: "payants", label: "Payants" },
  { key: "intra", label: "Intra/clients" },
  { key: "archives", label: "Archivés" },
];

export interface CourseMetaFilters {
  view: CourseQuickView;
  expertise: string; // "all" ou valeur d'expertise
  access: string; // "all" ou valeur d'accès
  status: string; // "all" ou valeur de statut
}

export const DEFAULT_COURSE_META_FILTERS: CourseMetaFilters = {
  view: "tous",
  expertise: "all",
  access: "all",
  status: "all",
};

interface CourseMetaLike {
  status: string;
  access_type?: string | null;
  expertise?: string | null;
}

function matchesView(course: CourseMetaLike, view: CourseQuickView): boolean {
  switch (view) {
    case "publies":
      return course.status === "published";
    case "brouillons":
      return course.status === "draft";
    case "a_verifier":
      return course.status === "to_review";
    case "archives":
      return course.status === "archived";
    case "gratuits":
      return (course.access_type ?? "gratuit") === "gratuit";
    case "payants":
      return course.access_type === "payant";
    case "intra":
      return course.access_type === "intra";
    default:
      return true;
  }
}

/**
 * Un cours archivé est masqué par défaut : il ne ressort que via la vue
 * "Archivés" ou le filtre statut = archived.
 */
export function courseMatchesMetaFilters(course: CourseMetaLike, f: CourseMetaFilters): boolean {
  const archivedVisible = f.view === "archives" || f.status === "archived";
  if (course.status === "archived" && !archivedVisible) return false;
  if (!matchesView(course, f.view)) return false;
  if (f.expertise !== "all" && course.expertise !== f.expertise) return false;
  if (f.access !== "all" && (course.access_type ?? "gratuit") !== f.access) return false;
  if (f.status !== "all" && course.status !== f.status) return false;
  return true;
}
