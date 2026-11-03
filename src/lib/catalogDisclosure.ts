/**
 * Mentions d'information du catalogue (indicateur 1).
 *
 * Quatre informations doivent pouvoir être portées à connaissance d'un public
 * avant l'inscription. Elles vivent sur `formation_configs` et se saisissent
 * dans l'écran du catalogue. Ce fichier ne dit pas ce qu'il faut écrire : il
 * dit seulement, pour une formation donnée, lesquelles sont renseignées.
 */

export interface CatalogDisclosureFields {
  recognition_type?: string | null;
  funding_terms?: string | null;
  access_delay?: string | null;
  accessibility_terms?: string | null;
}

export const DISCLOSURE_FIELDS = [
  { key: "access_delay", label: "Délai d'accès" },
  { key: "funding_terms", label: "Modalités de financement" },
  { key: "accessibility_terms", label: "Accessibilité" },
  { key: "recognition_type", label: "Sanction de la formation" },
] as const satisfies ReadonlyArray<{ key: keyof CatalogDisclosureFields; label: string }>;

/** Une mention vide, blanche ou absente compte pour non renseignée. */
const isFilled = (value: string | null | undefined) =>
  typeof value === "string" && value.trim().length > 0;

/** Libellés des mentions manquantes, dans l'ordre d'affichage. */
export function missingDisclosures(entry: CatalogDisclosureFields): string[] {
  return DISCLOSURE_FIELDS.filter((f) => !isFilled(entry[f.key])).map((f) => f.label);
}

export interface DisclosureSummary {
  filled: number;
  total: number;
  missing: string[];
  complete: boolean;
}

export function summarizeDisclosures(entry: CatalogDisclosureFields): DisclosureSummary {
  const missing = missingDisclosures(entry);
  return {
    filled: DISCLOSURE_FIELDS.length - missing.length,
    total: DISCLOSURE_FIELDS.length,
    missing,
    complete: missing.length === 0,
  };
}

/**
 * Combien de formations du catalogue sont complètes. Sert à dire en haut de
 * l'écran ce qui reste à saisir, sans parcourir les lignes une à une.
 */
export function countIncomplete(entries: CatalogDisclosureFields[]): number {
  return entries.filter((e) => missingDisclosures(e).length > 0).length;
}
