export const DOSSIER_FEE_WITH_SUBROGATION = 350;
export const DOSSIER_FEE_WITHOUT_SUBROGATION = 150;
export const REMISE_FRAIS_ADMIN = 150;

/**
 * Frais de dossier : 150€ sans subrogation, 350€ avec.
 * `remise` accepte un montant (nouveau champ éditable) ou un booléen (anciens devis = 150€).
 * La remise est plafonnée au montant des frais.
 */
export function getDossierFee(remise: boolean | number | null | undefined, subrogation: boolean): number {
  const base = subrogation ? DOSSIER_FEE_WITH_SUBROGATION : DOSSIER_FEE_WITHOUT_SUBROGATION;
  const amount = typeof remise === "number" && Number.isFinite(remise)
    ? Math.max(0, remise)
    : (remise ? REMISE_FRAIS_ADMIN : 0);
  return Math.max(0, base - Math.min(base, amount));
}
