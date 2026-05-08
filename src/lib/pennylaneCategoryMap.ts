/**
 * Heuristique de classement charge fixe / charge variable depuis les
 * libellés Pennylane (factures fournisseurs, catégories). On reste sur du
 * matching mot-clé : fiable pour les charges récurrentes typiques d'une
 * TPE/PME, et facile à étendre.
 */
export const FIXED_COST_KEYWORDS: readonly string[] = [
  "loyer",
  "rent",
  "abonnement",
  "subscription",
  "salaire",
  "salary",
  "paie",
  "payroll",
  "assurance",
  "insurance",
  "mutuelle",
  "telephonie",
  "téléphonie",
  "telephone",
  "téléphone",
  "phone",
  "mobile",
  "electricite",
  "électricité",
  "edf",
  "engie",
  "internet",
  "fibre",
  "comptable",
  "expert-comptable",
  "expert comptable",
  "accounting",
  "logiciel",
  "saas",
  "hébergement",
  "hosting",
  "domiciliation",
];

export function isFixedCost(label: string | null | undefined): boolean {
  if (!label) return false;
  const lower = label.toLowerCase();
  return FIXED_COST_KEYWORDS.some((k) => lower.includes(k));
}
