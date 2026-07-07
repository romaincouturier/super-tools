export type SourceFinancement =
  | "entreprise"
  | "opco_plan_competences"
  | "opco_cpf"
  | "opco_apprentissage"
  | "opco_professionnalisation"
  | "opco_alternance"
  | "opco_transition_pro"
  | "opco_demandeur_emploi"
  | "opco_tns"
  | "pouvoirs_publics_agents"
  | "instances_europeennes"
  | "etat"
  | "conseils_regionaux"
  | "france_travail"
  | "autres_publics"
  | "particulier"
  | "sous_traitance"
  | "autre";

export type BpfLineKey =
  | "ligne1" | "ligne2a" | "ligne2b" | "ligne2c" | "ligne2d"
  | "ligne2e" | "ligne2f" | "ligne2g" | "ligne2h"
  | "ligne3" | "ligne4" | "ligne5" | "ligne6" | "ligne7" | "ligne8"
  | "ligne9" | "ligne10" | "ligne11" | "unclassified";

export function mapSourceToBpfLine(source: SourceFinancement | null): BpfLineKey {
  switch (source) {
    case "entreprise":               return "ligne1";
    case "opco_apprentissage":       return "ligne2a";
    case "opco_professionnalisation":return "ligne2b";
    case "opco_alternance":          return "ligne2c";
    case "opco_transition_pro":      return "ligne2d";
    case "opco_cpf":                 return "ligne2e";
    case "opco_demandeur_emploi":    return "ligne2f";
    case "opco_tns":                 return "ligne2g";
    case "opco_plan_competences":    return "ligne2h";
    case "pouvoirs_publics_agents":  return "ligne3";
    case "instances_europeennes":    return "ligne4";
    case "etat":                     return "ligne5";
    case "conseils_regionaux":       return "ligne6";
    case "france_travail":           return "ligne7";
    case "autres_publics":           return "ligne8";
    case "particulier":              return "ligne9";
    case "sous_traitance":           return "ligne10";
    case "autre":                    return "ligne11";
    default:                         return "unclassified";
  }
}

export interface ScheduleSlot {
  start_time: string;
  end_time: string;
}

/**
 * Calcule les heures de formation selon la règle BPF :
 * créneau ≤ 4h → 3,5h comptabilisées ; créneau > 4h → 7h comptabilisées.
 * Les créneaux invalides (heure malformée ou durée nulle/négative) comptent 0.
 */
export function calcScheduleHours(schedules: ScheduleSlot[]): number {
  return schedules.reduce((total, s) => {
    const [sh, sm] = s.start_time.split(":").map(Number);
    const [eh, em] = s.end_time.split(":").map(Number);
    const durationHours = (eh * 60 + em - (sh * 60 + sm)) / 60;
    if (!Number.isFinite(durationHours) || durationHours <= 0) return total;
    return total + (durationHours <= 4 ? 3.5 : 7);
  }, 0);
}

export function totalBpfProduits(produits: Record<BpfLineKey, number>): number {
  const lines: BpfLineKey[] = [
    "ligne1","ligne2a","ligne2b","ligne2c","ligne2d","ligne2e","ligne2f","ligne2g","ligne2h",
    "ligne3","ligne4","ligne5","ligne6","ligne7","ligne8","ligne9","ligne10","ligne11",
  ];
  return lines.reduce((sum, k) => sum + (produits[k] ?? 0), 0);
}
