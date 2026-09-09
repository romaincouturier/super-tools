/**
 * Registre des risques qualité (indicateur 32).
 *
 * Le décret 2026-728 ajoute à l'indicateur 32 l'analyse des risques pesant sur
 * la qualité des formations. Il ne fixe **aucun** barème, aucun seuil et aucune
 * obligation chiffrée : les bandes de criticité ci-dessous ne servent qu'à
 * ordonner l'affichage et à colorer un badge. Elles ne prononcent jamais une
 * conformité ni une non-conformité, et rien dans l'application ne s'en déduit.
 *
 * La criticité elle-même n'est pas calculée ici : la colonne est générée par la
 * base (`probability * impact`), pour que personne ne puisse enregistrer une
 * valeur qui contredise ses deux facteurs.
 */

export const RISK_MODALITIES = [
  { value: "presentiel", label: "Présentiel" },
  { value: "distanciel_synchrone", label: "Distanciel synchrone" },
  { value: "elearning", label: "E-learning" },
  { value: "mixte", label: "Mixte" },
] as const;

export const RISK_STATUSES = [
  { value: "open", label: "Ouvert" },
  { value: "monitored", label: "Sous surveillance" },
  { value: "closed", label: "Clôturé" },
] as const;

export type RiskStatus = (typeof RISK_STATUSES)[number]["value"];

/**
 * Échelles à quatre niveaux, sans valeur médiane : forcer le choix entre
 * plutôt faible et plutôt fort évite le réflexe du « moyen », qui ne décide
 * rien et rend l'analyse inexploitable.
 */
export const PROBABILITY_LEVELS = [
  { value: 1, label: "Rare" },
  { value: 2, label: "Peu probable" },
  { value: 3, label: "Probable" },
  { value: 4, label: "Très probable" },
] as const;

export const IMPACT_LEVELS = [
  { value: 1, label: "Mineur" },
  { value: 2, label: "Modéré" },
  { value: 3, label: "Important" },
  { value: 4, label: "Majeur" },
] as const;

export type CriticalityBand = "faible" | "modere" | "eleve" | "critique";

export const BAND_LABELS: Record<CriticalityBand, string> = {
  faible: "Faible",
  modere: "Modéré",
  eleve: "Élevé",
  critique: "Critique",
};

/**
 * Bande d'affichage d'une criticité. Les produits possibles de deux échelles
 * de 1 à 4 sont 1, 2, 3, 4, 6, 8, 9, 12 et 16 : les bornes ci-dessous tombent
 * dans les trous de cette suite, donc aucune valeur n'est à cheval.
 */
export function criticalityBand(criticality: number): CriticalityBand {
  if (criticality >= 12) return "critique";
  if (criticality >= 8) return "eleve";
  if (criticality >= 4) return "modere";
  return "faible";
}

function labelFrom(
  list: ReadonlyArray<{ value: string; label: string }>,
  value: string | null | undefined,
): string {
  return list.find((entry) => entry.value === value)?.label ?? "—";
}

export const modalityLabel = (v: string | null | undefined) => labelFrom(RISK_MODALITIES, v);
export const riskStatusLabel = (v: string | null | undefined) => labelFrom(RISK_STATUSES, v);

export function scaleLabel(
  levels: ReadonlyArray<{ value: number; label: string }>,
  value: number,
): string {
  return levels.find((entry) => entry.value === value)?.label ?? String(value);
}

/** Un risque encore actif dont la date de revue est passée. */
export function isReviewOverdue(
  risk: { status: string; review_date: string | null },
  today: string,
): boolean {
  if (risk.status === "closed") return false;
  if (!risk.review_date) return false;
  return risk.review_date < today;
}

/** Champs du formulaire de risque, tels que saisis à l'écran. */
export interface QualityRiskFormValues {
  label: string;
  formation_config_id: string;
  modality: string;
  cause: string;
  probability: number;
  impact: number;
  preventive_measure: string;
  owner: string;
  review_date: string;
  status: string;
  reclamation_id: string;
  improvement_id: string;
}

export interface QualityRiskRecord {
  label: string;
  formation_config_id: string | null;
  modality: string | null;
  cause: string | null;
  probability: number;
  impact: number;
  preventive_measure: string | null;
  owner: string | null;
  review_date: string | null;
  status: string;
  reclamation_id: string | null;
  improvement_id: string | null;
}

export const EMPTY_RISK_FORM: QualityRiskFormValues = {
  label: "",
  formation_config_id: "",
  modality: "",
  cause: "",
  probability: 1,
  impact: 1,
  preventive_measure: "",
  owner: "",
  review_date: "",
  status: "open",
  reclamation_id: "",
  improvement_id: "",
};

/**
 * Enregistrement à écrire en base à partir du formulaire.
 *
 * Les trois rattachements — formation, réclamation d'origine, action
 * d'amélioration engagée — restent facultatifs : un risque transverse n'en a
 * aucun, et le décret n'en exige pas.
 */
export function buildRiskRecord(form: QualityRiskFormValues): QualityRiskRecord {
  const trimmed = (value: string) => value.trim() || null;
  return {
    label: form.label.trim(),
    formation_config_id: form.formation_config_id || null,
    modality: form.modality || null,
    cause: trimmed(form.cause),
    probability: form.probability,
    impact: form.impact,
    preventive_measure: trimmed(form.preventive_measure),
    owner: trimmed(form.owner),
    review_date: form.review_date || null,
    status: form.status,
    reclamation_id: form.reclamation_id || null,
    improvement_id: form.improvement_id || null,
  };
}

export interface RiskSummary {
  active: number;
  overdue: number;
  /** Risques actifs par bande, du plus critique au plus faible. */
  byBand: Record<CriticalityBand, number>;
  /**
   * Risques actifs de bande élevée ou critique auxquels aucune mesure
   * préventive n'est opposée. C'est le seul chiffre du registre qui appelle
   * une action ; il ne prononce aucune non-conformité.
   */
  unmitigated: number;
}

/**
 * Synthèse du registre. Ne porte que sur les risques actifs : un risque clôturé
 * documente le passé, il ne pèse plus sur la maîtrise actuelle.
 */
export function summarizeRisks(
  risks: ReadonlyArray<{
    status: string;
    criticality: number;
    review_date: string | null;
    preventive_measure: string | null;
  }>,
  today: string,
): RiskSummary {
  const active = risks.filter((r) => r.status !== "closed");
  const byBand: Record<CriticalityBand, number> = {
    critique: 0,
    eleve: 0,
    modere: 0,
    faible: 0,
  };
  for (const risk of active) byBand[criticalityBand(risk.criticality)] += 1;

  return {
    active: active.length,
    overdue: active.filter((r) => isReviewOverdue(r, today)).length,
    byBand,
    unmitigated: active.filter((r) => {
      const band = criticalityBand(r.criticality);
      return (band === "eleve" || band === "critique") && !r.preventive_measure?.trim();
    }).length,
  };
}
