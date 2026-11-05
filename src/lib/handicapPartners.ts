/**
 * Réseau de partenaires du champ du handicap (indicateur 26).
 *
 * Le référentiel attend que l'organisme démontre l'identification d'un réseau
 * de partenaires, experts et acteurs du handicap, mobilisable par les
 * personnels. Ce fichier ne juge pas le réseau : il borne les types de
 * handicap couverts, pour qu'une liste reste lisible et qu'on voie d'un coup
 * d'œil ce qui n'est couvert par personne.
 */

export const HANDICAP_TYPES = [
  { value: "tous", label: "Tous handicaps" },
  { value: "auditif", label: "Déficiences auditives" },
  { value: "visuel", label: "Déficiences visuelles" },
  { value: "moteur", label: "Déficiences motrices" },
  { value: "psychique", label: "Troubles psychiques" },
  { value: "cognitif", label: "Troubles cognitifs et dys" },
  { value: "autre", label: "Autre" },
] as const;

export type HandicapType = (typeof HANDICAP_TYPES)[number]["value"];

export function handicapTypeLabel(value: string | null | undefined): string {
  return HANDICAP_TYPES.find((t) => t.value === value)?.label ?? "—";
}

export interface HandicapPartnerLike {
  handicap_type?: string | null;
  is_active?: boolean | null;
}

/**
 * Types de handicap qu'aucun partenaire actif ne couvre. « Tous handicaps »
 * couvre l'ensemble : un partenaire généraliste suffit à ne rien laisser
 * découvert, et l'écran ne doit pas réclamer un spécialiste par déficience.
 */
export function uncoveredTypes(partners: HandicapPartnerLike[]): string[] {
  const active = partners.filter((p) => p.is_active !== false);
  if (active.some((p) => p.handicap_type === "tous")) return [];
  const covered = new Set(active.map((p) => p.handicap_type));
  return HANDICAP_TYPES.filter((t) => t.value !== "tous" && t.value !== "autre")
    .filter((t) => !covered.has(t.value))
    .map((t) => t.label);
}

export function activeCount(partners: HandicapPartnerLike[]): number {
  return partners.filter((p) => p.is_active !== false).length;
}
