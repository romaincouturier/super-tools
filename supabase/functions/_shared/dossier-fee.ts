export const DOSSIER_FEE_WITH_SUBROGATION = 350;
export const DOSSIER_FEE_WITHOUT_SUBROGATION = 150;
export const REMISE_FRAIS_ADMIN = 150;

/**
 * Frais de dossier : 150€ sans subrogation, 350€ avec.
 * Si "offrir les frais administratifs" est actif, on retire 150€ (plancher 0).
 */
export function getDossierFee(offrirFraisAdmin: boolean, subrogation: boolean): number {
  const base = subrogation ? DOSSIER_FEE_WITH_SUBROGATION : DOSSIER_FEE_WITHOUT_SUBROGATION;
  const remise = offrirFraisAdmin ? REMISE_FRAIS_ADMIN : 0;
  return Math.max(0, base - remise);
}
