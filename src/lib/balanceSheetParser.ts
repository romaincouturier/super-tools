/**
 * Schéma normalisé du bilan comptable et calculs financiers dérivés.
 * Tous les montants sont en euros. 0 si rubrique absente.
 */

export interface BalanceSheetActif {
  immobilisations_incorporelles: number;
  immobilisations_corporelles: number;
  immobilisations_financieres: number;
  stocks: number;
  creances_clients: number;
  autres_creances: number;
  disponibilites: number;
  valeurs_mobilieres_placement: number;
  total_actif: number;
}

export interface BalanceSheetPassif {
  capital_social: number;
  reserves: number;
  resultat_exercice: number;
  capitaux_propres: number;
  provisions: number;
  dettes_financieres_long_terme: number;
  dettes_financieres_court_terme: number;
  dettes_fournisseurs_court_terme: number;
  dettes_fiscales_sociales_court_terme: number;
  autres_dettes_court_terme: number;
  total_passif: number;
}

export interface CompteResultat {
  chiffre_affaires: number;
  charges_exploitation: number;
  resultat_exploitation: number;
  resultat_financier: number;
  resultat_exceptionnel: number;
  impot_societes: number;
  resultat_net: number;
}

export interface BalanceSheetData {
  annee: number;
  actif: BalanceSheetActif;
  passif: BalanceSheetPassif;
  compte_resultat: CompteResultat;
}

export const EMPTY_ACTIF: BalanceSheetActif = {
  immobilisations_incorporelles: 0,
  immobilisations_corporelles: 0,
  immobilisations_financieres: 0,
  stocks: 0,
  creances_clients: 0,
  autres_creances: 0,
  disponibilites: 0,
  valeurs_mobilieres_placement: 0,
  total_actif: 0,
};

export const EMPTY_PASSIF: BalanceSheetPassif = {
  capital_social: 0,
  reserves: 0,
  resultat_exercice: 0,
  capitaux_propres: 0,
  provisions: 0,
  dettes_financieres_long_terme: 0,
  dettes_financieres_court_terme: 0,
  dettes_fournisseurs_court_terme: 0,
  dettes_fiscales_sociales_court_terme: 0,
  autres_dettes_court_terme: 0,
  total_passif: 0,
};

export const EMPTY_COMPTE_RESULTAT: CompteResultat = {
  chiffre_affaires: 0,
  charges_exploitation: 0,
  resultat_exploitation: 0,
  resultat_financier: 0,
  resultat_exceptionnel: 0,
  impot_societes: 0,
  resultat_net: 0,
};

export function emptyBalanceSheet(annee: number): BalanceSheetData {
  return {
    annee,
    actif: { ...EMPTY_ACTIF },
    passif: { ...EMPTY_PASSIF },
    compte_resultat: { ...EMPTY_COMPTE_RESULTAT },
  };
}

export function computeImmobilisationsTotal(d: BalanceSheetData): number {
  const a = d.actif;
  return a.immobilisations_incorporelles + a.immobilisations_corporelles + a.immobilisations_financieres;
}

/**
 * Besoin en Fonds de Roulement.
 * BFR = Stocks + Créances clients - Dettes fournisseurs CT
 * (les dettes fiscales/sociales CT sont parfois incluses, on reste sur la
 * définition "BFR d'exploitation" stricte).
 */
export function computeBFR(d: BalanceSheetData): number {
  const a = d.actif;
  const p = d.passif;
  return a.stocks + a.creances_clients - p.dettes_fournisseurs_court_terme;
}

/**
 * Trésorerie nette = (Disponibilités + VMP) - Dettes financières CT.
 */
export function computeTresorerieNette(d: BalanceSheetData): number {
  const a = d.actif;
  const p = d.passif;
  return a.disponibilites + a.valeurs_mobilieres_placement - p.dettes_financieres_court_terme;
}

/**
 * Ratio d'autonomie financière = Capitaux propres / Total passif (en %).
 * Un ratio < 20% est généralement considéré comme à risque.
 */
export function computeRatioAutonomie(d: BalanceSheetData): number {
  if (d.passif.total_passif <= 0) return 0;
  return (d.passif.capitaux_propres / d.passif.total_passif) * 100;
}

/**
 * Taux de rentabilité nette = Résultat net / Chiffre d'affaires (en %).
 */
export function computeRentabiliteNette(d: BalanceSheetData): number {
  if (d.compte_resultat.chiffre_affaires <= 0) return 0;
  return (d.compte_resultat.resultat_net / d.compte_resultat.chiffre_affaires) * 100;
}

/**
 * Fonds de roulement = Capitaux propres + Dettes financières LT - Immobilisations.
 * Un FR > 0 indique que les ressources stables couvrent les emplois stables.
 */
export function computeFondsRoulement(d: BalanceSheetData): number {
  return (
    d.passif.capitaux_propres +
    d.passif.dettes_financieres_long_terme -
    computeImmobilisationsTotal(d)
  );
}

export interface BalanceSheetMetrics {
  bfr: number;
  tresorerieNette: number;
  ratioAutonomie: number;
  rentabiliteNette: number;
  fondsRoulement: number;
}

export function computeMetrics(d: BalanceSheetData): BalanceSheetMetrics {
  return {
    bfr: computeBFR(d),
    tresorerieNette: computeTresorerieNette(d),
    ratioAutonomie: computeRatioAutonomie(d),
    rentabiliteNette: computeRentabiliteNette(d),
    fondsRoulement: computeFondsRoulement(d),
  };
}

export function isBalanceConsistent(d: BalanceSheetData, tolerance: number = 1): boolean {
  return Math.abs(d.actif.total_actif - d.passif.total_passif) <= tolerance;
}
