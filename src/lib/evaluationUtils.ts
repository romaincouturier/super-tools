/**
 * Pure utility functions for training evaluation stats and label formatting.
 *
 * All functions are side-effect-free and easily unit-testable.
 */

// ── Types ────────────────────────────────────────────────────────────────────

/** Full evaluation data shape used by EvaluationDetailDialog. */
export interface EvaluationData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  email: string | null;
  appreciation_generale: number | null;
  recommandation: string | null;
  message_recommandation: string | null;
  objectifs_evaluation: { objectif: string; niveau: number }[] | null;
  objectif_prioritaire: string | null;
  delai_application: string | null;
  freins_application: string | null;
  rythme: string | null;
  equilibre_theorie_pratique: string | null;
  amelioration_suggeree: string | null;
  conditions_info_satisfaisantes: boolean | null;
  formation_adaptee_public: boolean | null;
  qualification_intervenant_adequate: boolean | null;
  appreciations_prises_en_compte: string | null;
  consent_publication: boolean | null;
  remarques_libres: string | null;
  date_soumission: string | null;
}

export interface EvaluationInfo {
  evaluationId: string;
  etat: string;
  date_soumission: string | null;
  appreciation_generale: number | null;
  recommandation: string | null;
  fullData: EvaluationData | null;
}

export interface CertificateInfo {
  evaluationId: string;
  certificateUrl: string | null;
}

export interface EvaluationSummaryStats {
  total: number;
  soumis: number;
  envoye: number;
  nonEnvoye: number;
  avgRating: number;
  recommendationRate: number;
}

// ── Stats computation ────────────────────────────────────────────────────────

/**
 * Compute summary stats from an evaluation map keyed by participant ID.
 *
 * @param evaluations  Map of participantId → EvaluationInfo (all states)
 * @param totalParticipants  Total number of participants in the training
 */
export function computeEvaluationStats(
  evaluations: Map<string, EvaluationInfo>,
  totalParticipants: number,
): EvaluationSummaryStats {
  const values = Array.from(evaluations.values());
  const total = evaluations.size;
  const soumis = values.filter((e) => e.etat === "soumis").length;
  const envoye = values.filter((e) => e.etat === "envoye").length;
  const nonEnvoye = Math.max(0, totalParticipants - total);

  const withRating = values.filter(
    (e) => e.etat === "soumis" && e.appreciation_generale != null,
  );
  const avgRating =
    withRating.length > 0
      ? withRating.reduce((sum, e) => sum + (e.appreciation_generale ?? 0), 0) /
        withRating.length
      : 0;

  const withRecommandation = values.filter(
    (e) => e.etat === "soumis" && e.recommandation != null,
  );
  const positiveRecommandations = withRecommandation.filter(
    (e) =>
      e.recommandation === "oui" || e.recommandation === "oui_avec_enthousiasme",
  );
  const recommendationRate =
    withRecommandation.length > 0
      ? Math.round(
          (positiveRecommandations.length / withRecommandation.length) * 100,
        )
      : 0;

  return { total, soumis, envoye, nonEnvoye, avgRating, recommendationRate };
}

/**
 * Compute average rating from a flat array of evaluations (used in Evaluations page).
 */
export function computeAvgRating(
  evaluations: { appreciation_generale: number | null }[],
): number {
  const withRating = evaluations.filter((e) => e.appreciation_generale != null);
  if (withRating.length === 0) return 0;
  return (
    withRating.reduce((sum, e) => sum + (e.appreciation_generale ?? 0), 0) /
    withRating.length
  );
}

/**
 * Compute recommendation rate (%) from a flat array of evaluations.
 */
export function computeRecommendationRate(
  evaluations: { recommandation: string | null }[],
): number {
  const withReco = evaluations.filter((e) => e.recommandation != null);
  if (withReco.length === 0) return 0;
  const positive = withReco.filter(
    (e) =>
      e.recommandation === "oui" || e.recommandation === "oui_avec_enthousiasme",
  );
  return Math.round((positive.length / withReco.length) * 100);
}

// ── Map builders ─────────────────────────────────────────────────────────────

interface RawEvaluationRow {
  id: string;
  participant_id: string | null;
  certificate_url: string | null;
  etat: string;
  date_soumission: string | null;
  appreciation_generale: number | null;
  recommandation: string | null;
  [key: string]: unknown;
}

/**
 * Extract a typed EvaluationData from a raw Supabase row.
 */
function extractEvaluationData(ev: RawEvaluationRow): EvaluationData {
  return {
    id: ev.id,
    first_name: (ev.first_name as string | null) ?? null,
    last_name: (ev.last_name as string | null) ?? null,
    company: (ev.company as string | null) ?? null,
    email: (ev.email as string | null) ?? null,
    appreciation_generale: ev.appreciation_generale,
    recommandation: ev.recommandation,
    message_recommandation: (ev.message_recommandation as string | null) ?? null,
    objectifs_evaluation: (ev.objectifs_evaluation as EvaluationData["objectifs_evaluation"]) ?? null,
    objectif_prioritaire: (ev.objectif_prioritaire as string | null) ?? null,
    delai_application: (ev.delai_application as string | null) ?? null,
    freins_application: (ev.freins_application as string | null) ?? null,
    rythme: (ev.rythme as string | null) ?? null,
    equilibre_theorie_pratique: (ev.equilibre_theorie_pratique as string | null) ?? null,
    amelioration_suggeree: (ev.amelioration_suggeree as string | null) ?? null,
    conditions_info_satisfaisantes: (ev.conditions_info_satisfaisantes as boolean | null) ?? null,
    formation_adaptee_public: (ev.formation_adaptee_public as boolean | null) ?? null,
    qualification_intervenant_adequate: (ev.qualification_intervenant_adequate as boolean | null) ?? null,
    appreciations_prises_en_compte: (ev.appreciations_prises_en_compte as string | null) ?? null,
    consent_publication: (ev.consent_publication as boolean | null) ?? null,
    remarques_libres: (ev.remarques_libres as string | null) ?? null,
    date_soumission: ev.date_soumission,
  };
}

/**
 * Build certificate & evaluation Maps from raw Supabase rows.
 */
export function buildEvaluationMaps(rows: RawEvaluationRow[]): {
  certificateMap: Map<string, CertificateInfo>;
  evaluationMap: Map<string, EvaluationInfo>;
} {
  const certificateMap = new Map<string, CertificateInfo>();
  const evaluationMap = new Map<string, EvaluationInfo>();

  for (const ev of rows) {
    if (!ev.participant_id) continue;

    if (ev.etat === "soumis") {
      certificateMap.set(ev.participant_id, {
        evaluationId: ev.id,
        certificateUrl: ev.certificate_url || null,
      });
    }

    evaluationMap.set(ev.participant_id, {
      evaluationId: ev.id,
      etat: ev.etat,
      date_soumission: ev.date_soumission,
      appreciation_generale: ev.appreciation_generale,
      recommandation: ev.recommandation,
      fullData: ev.etat === "soumis" ? extractEvaluationData(ev) : null,
    });
  }

  return { certificateMap, evaluationMap };
}

// ── Label helpers ────────────────────────────────────────────────────────────

const RECOMMANDATION_LABELS: Record<string, string> = {
  oui_avec_enthousiasme: "Recommande vivement",
  oui: "Recommande",
  non: "Ne recommande pas",
};

const RECOMMANDATION_VARIANTS: Record<string, "default" | "secondary" | "destructive"> = {
  oui_avec_enthousiasme: "default",
  oui: "secondary",
  non: "destructive",
};

export function getRecommandationLabel(recommandation: string | null): string | null {
  if (!recommandation) return null;
  return RECOMMANDATION_LABELS[recommandation] ?? recommandation;
}

export function getRecommandationVariant(
  recommandation: string | null,
): "default" | "secondary" | "destructive" {
  if (!recommandation) return "secondary";
  return RECOMMANDATION_VARIANTS[recommandation] ?? "secondary";
}

export function getDelaiApplicationLabel(delai: string | null): string | null {
  if (!delai) return null;
  const labels: Record<string, string> = {
    cette_semaine: "Cette semaine",
    ce_mois: "Ce mois-ci",
    "3_mois": "Dans les 3 mois",
  };
  return labels[delai] ?? "Application incertaine";
}

export function getRythmeLabel(rythme: string | null): string | null {
  if (!rythme) return null;
  const labels: Record<string, string> = {
    trop_lent: "Trop lent",
    adapte: "Adapté",
    trop_rapide: "Trop rapide",
  };
  return labels[rythme] ?? rythme;
}

export function getEquilibreLabel(equilibre: string | null): string | null {
  if (!equilibre) return null;
  const labels: Record<string, string> = {
    trop_theorique: "Trop théorique",
    equilibre: "Équilibré",
    pas_assez_structure: "Pas assez structuré",
  };
  return labels[equilibre] ?? equilibre;
}

export function getAppreciationsLabel(value: string | null): string | null {
  if (!value) return null;
  const labels: Record<string, string> = {
    oui: "Oui",
    non: "Non",
    sans_objet: "Sans objet",
  };
  return labels[value] ?? value;
}

/**
 * Format a participant display name from first/last name parts.
 * Returns "Anonyme" if both are absent.
 */
export function formatEvaluationDisplayName(
  firstName: string | null,
  lastName: string | null,
): string {
  if (firstName || lastName) {
    return `${firstName || ""} ${lastName || ""}`.trim();
  }
  return "Anonyme";
}
