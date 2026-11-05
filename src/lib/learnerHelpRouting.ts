/**
 * Destination d'une demande déposée depuis l'espace apprenant.
 *
 * Jusqu'ici tout partait dans le kanban produit, y compris une insatisfaction
 * pédagogique, qui s'y perdait entre les bugs. Le référentiel attend que les
 * réclamations, les difficultés et les aléas soient traités et tracés
 * (indicateur 31) : ce qui relève de la prestation va désormais au registre,
 * ce qui relève de l'outil reste au kanban.
 *
 * La nature retenue suit la terminologie du registre : une question
 * pédagogique est une **difficulté** rencontrée, pas une réclamation. Les
 * confondre gonflerait le nombre de réclamations avec des demandes qui n'en
 * sont pas.
 */

export type HelpDestination = "support" | "reclamation";

export interface LearnerHelpCategory {
  value: string;
  label: string;
  destination: HelpDestination;
  /** Pour le registre : nature et type de problème. */
  nature?: "reclamation" | "difficulte";
  problemType?: string;
}

export const LEARNER_HELP_CATEGORIES: LearnerHelpCategory[] = [
  { value: "acces_connexion", label: "Accès / Connexion", destination: "support" },
  { value: "technique", label: "Problème technique", destination: "support" },
  {
    value: "pedagogique",
    label: "Question pédagogique",
    destination: "reclamation",
    nature: "difficulte",
    problemType: "contenu",
  },
  {
    value: "administratif",
    label: "Administratif",
    destination: "reclamation",
    nature: "difficulte",
    problemType: "organisation",
  },
  {
    value: "reclamation",
    label: "Réclamation",
    destination: "reclamation",
    nature: "reclamation",
    problemType: "autre",
  },
];

export function findHelpCategory(value: string | null | undefined): LearnerHelpCategory | null {
  if (!value) return null;
  return LEARNER_HELP_CATEGORIES.find((c) => c.value === value) ?? null;
}

/**
 * Une catégorie inconnue ou absente part au support : c'est la destination qui
 * existait avant, et perdre une demande serait pire que la mal classer.
 */
export function helpDestination(value: string | null | undefined): HelpDestination {
  return findHelpCategory(value)?.destination ?? "support";
}

export function reclamationFieldsFor(
  value: string | null | undefined,
): { nature: string; problemType: string } | null {
  const category = findHelpCategory(value);
  if (!category || category.destination !== "reclamation") return null;
  return { nature: category.nature ?? "difficulte", problemType: category.problemType ?? "autre" };
}
