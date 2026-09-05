export const DOSSIER_FEE_WITH_SUBROGATION = 350;
export const DOSSIER_FEE_WITHOUT_SUBROGATION = 150;
export const REMISE_FRAIS_ADMIN = 150;

export interface DevisTotals {
  prixFormation: number;
  baseFrais: number;
  remise: number;
  frais: number;
  totalHT: number;
  totalTTC: number;
}

/** Montant de remise effectif : champ montant si fourni, sinon ancien booléen (= 150€). */
export function resolveRemiseFraisAdmin(params: {
  remiseFraisAdmin?: number | null;
  offrirFraisAdmin?: boolean;
}): number {
  const { remiseFraisAdmin, offrirFraisAdmin } = params;
  if (typeof remiseFraisAdmin === "number" && Number.isFinite(remiseFraisAdmin)) {
    return Math.max(0, remiseFraisAdmin);
  }
  return offrirFraisAdmin ? REMISE_FRAIS_ADMIN : 0;
}

export function computeDevisTotals(params: {
  prixUnitaire: number;
  nbParticipants: number;
  variant: "sans" | "avec";
  offrirFraisAdmin?: boolean;
  remiseFraisAdmin?: number | null;
}): DevisTotals {
  const { prixUnitaire, nbParticipants, variant } = params;
  const prixFormation = prixUnitaire * nbParticipants;
  const baseFrais = variant === "avec" ? DOSSIER_FEE_WITH_SUBROGATION : DOSSIER_FEE_WITHOUT_SUBROGATION;
  const remise = Math.min(baseFrais, resolveRemiseFraisAdmin(params));
  const frais = Math.max(0, baseFrais - remise);
  const totalHT = prixFormation + frais;
  return { prixFormation, baseFrais, remise, frais, totalHT, totalTTC: totalHT };
}
