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
  | "catalogue_actif"
  | "a_verifier"
  | "brouillons"
  | "gratuits"
  | "payants"
  | "intra"
  | "archives"
  | "tous";

export const QUICK_VIEWS: { key: CourseQuickView; label: string; hint: string }[] = [
  { key: "catalogue_actif", label: "Catalogue actif", hint: "Cours standards du catalogue (hors intra / clients et archives)." },
  { key: "a_verifier", label: "À vérifier", hint: "Cours au statut éditorial « À vérifier »." },
  { key: "brouillons", label: "Brouillons", hint: "Cours en cours de rédaction, non publiés." },
  { key: "gratuits", label: "Gratuits", hint: "Cours en accès gratuit (hors archives)." },
  { key: "payants", label: "Payants", hint: "Cours en accès payant (hors archives)." },
  { key: "intra", label: "Intra / clients", hint: "Cours réservés à un client (intra), hors catalogue public." },
  { key: "archives", label: "Archives", hint: "Cours archivés, sortis du catalogue courant." },
  { key: "tous", label: "Tous les cours", hint: "Tous les cours, archives comprises." },
];

export interface CourseMetaFilters {
  view: CourseQuickView;
  expertise: string; // "all" ou valeur d'expertise
  access: string; // "all" ou valeur d'accès
  status: string; // "all" ou valeur de statut
}

export const DEFAULT_COURSE_META_FILTERS: CourseMetaFilters = {
  view: "catalogue_actif",
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
    case "catalogue_actif":
      return course.access_type !== "intra";
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
 * "Archives" ou le filtre statut = archived. La vue "Catalogue actif" exclut
 * en plus les cours intra / clients (voir matchesView).
 */
export function courseMatchesMetaFilters(course: CourseMetaLike, f: CourseMetaFilters): boolean {
  const archivedVisible = f.view === "archives" || f.view === "tous" || f.status === "archived";
  if (course.status === "archived" && !archivedVisible) return false;
  if (!matchesView(course, f.view)) return false;
  if (f.expertise !== "all" && course.expertise !== f.expertise) return false;
  if (f.access !== "all" && (course.access_type ?? "gratuit") !== f.access) return false;
  if (f.status !== "all" && course.status !== f.status) return false;
  return true;
}
