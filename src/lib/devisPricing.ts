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

export function computeDevisTotals(params: {
  prixUnitaire: number;
  nbParticipants: number;
  variant: "sans" | "avec";
  offrirFraisAdmin?: boolean;
}): DevisTotals {
  const { prixUnitaire, nbParticipants, variant, offrirFraisAdmin } = params;
  const prixFormation = prixUnitaire * nbParticipants;
  const baseFrais = variant === "avec" ? DOSSIER_FEE_WITH_SUBROGATION : DOSSIER_FEE_WITHOUT_SUBROGATION;
  const remise = offrirFraisAdmin ? REMISE_FRAIS_ADMIN : 0;
  const frais = Math.max(0, baseFrais - remise);
  const totalHT = prixFormation + frais;
  return { prixFormation, baseFrais, remise, frais, totalHT, totalTTC: totalHT };
}
