/**
 * Diagnostic d'intégration supertilt.fr (WooCommerce) ↔ cours e-learning.
 *
 * Rappel de la chaîne d'inscription automatique (voir supabase/functions/supertilt-webhook) :
 *   commande Woo → formation_formulas.woocommerce_product_id (maillon A)
 *              → session liée via training_formulas / fallback catalog_id (maillon B)
 *              → trainings.supports_lms_course_id = cours LMS (maillon C)
 *              → trigger auto_enroll_participant_in_lms → lms_enrollments
 *
 * Ce module reconstitue la chaîne EN PARTANT du cours LMS pour dire, par cours,
 * si un achat sur supertilt.fr inscrira bien l'apprenant, et sinon quel maillon
 * manque et quoi faire. Lecture seule : aucune écriture.
 */

export type IntegrationStatus =
  | "ok"
  | "ok_fallback"
  | "no_woo"
  | "no_formula"
  | "no_session"
  | "not_applicable";

export interface CourseLike {
  id: string;
  title: string;
  access_type: string | null;
}

export interface TrainingLike {
  id: string;
  training_name: string;
  is_cancelled: boolean | null;
  catalog_id: string | null;
  supports_lms_course_id: string | null;
}

export interface TrainingFormulaLink {
  training_id: string;
  formula_id: string;
}

export interface FormulaLike {
  id: string;
  name: string;
  formation_config_id: string | null;
  woocommerce_product_id: number | null;
}

export interface RecommendedAction {
  label: string;
  to: string;
}

export interface CourseIntegration {
  courseId: string;
  courseTitle: string;
  status: IntegrationStatus;
  /** Sessions dont le support pointe vers ce cours. */
  trainings: { id: string; name: string }[];
  /** IDs produits WooCommerce atteignables par la chaîne. */
  wooProductIds: number[];
  /** Message d'état lisible. */
  detail: string;
  /** Action corrective à mener, ou null si l'intégration est correcte. */
  action: string | null;
  /** Boutons d'action recommandés. */
  actions: RecommendedAction[];
}

const STATUS_SEVERITY: Record<IntegrationStatus, number> = {
  no_session: 0,
  no_formula: 1,
  no_woo: 2,
  ok_fallback: 3,
  ok: 4,
  not_applicable: 5,
};

export const STATUS_LABEL: Record<IntegrationStatus, string> = {
  ok: "Intégration OK",
  ok_fallback: "OK (via catalog_id)",
  no_woo: "Produit Woo manquant",
  no_formula: "Formule non reliée",
  no_session: "Aucune session",
  not_applicable: "Non concerné",
};

/** true = état sain (l'achat inscrit bien l'apprenant). */
export function isHealthy(status: IntegrationStatus): boolean {
  return status === "ok" || status === "ok_fallback";
}

export function computeCourseIntegration(
  course: CourseLike,
  trainings: TrainingLike[],
  links: TrainingFormulaLink[],
  formulas: FormulaLike[],
): CourseIntegration {
  const base = { courseId: course.id, courseTitle: course.title };

  // Les cours intra / clients ne sont pas vendus sur supertilt.fr.
  if (course.access_type === "intra") {
    return {
      ...base,
      status: "not_applicable",
      trainings: [],
      wooProductIds: [],
      detail: "Cours intra / client — non vendu sur supertilt.fr, inscription gérée manuellement.",
      action: null,
      actions: [],
    };
  }

  // Maillon C : sessions actives dont le support pointe vers ce cours.
  const linkedTrainings = trainings.filter(
    (t) => t.supports_lms_course_id === course.id && t.is_cancelled !== true,
  );

  if (linkedTrainings.length === 0) {
    return {
      ...base,
      status: "no_session",
      trainings: [],
      wooProductIds: [],
      detail: "Aucune session ne référence ce cours comme support.",
      action:
        "Crée d'abord la formation dans le catalogue, puis crée une session e-learning permanente et choisis ce cours comme support de type LMS (trainings.supports_lms_course_id).",
      actions: [
        { label: "Créer la formation dans le catalogue", to: "/catalogue" },
        { label: "Créer une session e-learning", to: "/formations" },
      ],
    };
  }

  const trainingsCtx = linkedTrainings.map((t) => ({ id: t.id, name: t.training_name }));
  const formulaById = new Map(formulas.map((f) => [f.id, f]));

  // Maillon B : formules reliées à ces sessions.
  //  - explicite : via training_formulas
  //  - fallback  : formation_config_id de la formule == catalog_id de la session
  const explicit = new Set<FormulaLike>();
  const fallback = new Set<FormulaLike>();
  for (const t of linkedTrainings) {
    for (const l of links) {
      if (l.training_id === t.id) {
        const f = formulaById.get(l.formula_id);
        if (f) explicit.add(f);
      }
    }
    if (t.catalog_id) {
      for (const f of formulas) {
        if (f.formation_config_id === t.catalog_id) fallback.add(f);
      }
    }
  }

  if (explicit.size === 0 && fallback.size === 0) {
    return {
      ...base,
      status: "no_formula",
      trainings: trainingsCtx,
      wooProductIds: [],
      detail: "La ou les sessions liées ne sont reliées à aucune formule d'achat.",
      action:
        "Relie une formule (celle vendue sur supertilt.fr) à la session via training_formulas.",
      actions: [{ label: "Modifier la session", to: `/formations/${linkedTrainings[0].id}/edit` }],
    };
  }

  const wooFrom = (set: Set<FormulaLike>) =>
    [...set].map((f) => f.woocommerce_product_id).filter((id): id is number => typeof id === "number");

  const wooExplicit = wooFrom(explicit);
  const wooFallback = wooFrom(fallback);

  // Maillon A : au moins une formule de la chaîne porte un ID produit WooCommerce.
  if (wooExplicit.length > 0) {
    return {
      ...base,
      status: "ok",
      trainings: trainingsCtx,
      wooProductIds: [...new Set(wooExplicit)],
      detail: "Chaîne complète : un achat sur supertilt.fr inscrit l'apprenant à ce cours.",
      action: null,
      actions: [],
    };
  }

  if (wooFallback.length > 0) {
    return {
      ...base,
      status: "ok_fallback",
      trainings: trainingsCtx,
      wooProductIds: [...new Set(wooFallback)],
      detail: "Fonctionne uniquement via le fallback catalog_id (aucune liaison explicite déclarée).",
      action:
        "Déclare la liaison explicite formule ↔ session (training_formulas) pour fiabiliser le routage.",
      actions: [{ label: "Modifier la session", to: `/formations/${linkedTrainings[0].id}/edit` }],
    };
  }

  return {
    ...base,
    status: "no_woo",
    trainings: trainingsCtx,
    wooProductIds: [],
    detail: "Une formule est reliée mais aucune ne porte d'ID produit WooCommerce.",
    action:
      "Renseigne le woocommerce_product_id de la formule (l'ID du produit vendu sur supertilt.fr).",
    actionLink: "/catalogue",
    actionLinkLabel: "Ouvrir le catalogue",
  };
}

/** Trie les diagnostics du plus problématique au plus sain. */
export function sortBySeverity(list: CourseIntegration[]): CourseIntegration[] {
  return [...list].sort(
    (a, b) =>
      STATUS_SEVERITY[a.status] - STATUS_SEVERITY[b.status] ||
      a.courseTitle.localeCompare(b.courseTitle),
  );
}

export interface IntegrationSummary {
  total: number;
  healthy: number;
  toFix: number;
  notApplicable: number;
}

export function summarize(list: CourseIntegration[]): IntegrationSummary {
  let healthy = 0;
  let toFix = 0;
  let notApplicable = 0;
  for (const c of list) {
    if (c.status === "not_applicable") notApplicable++;
    else if (isHealthy(c.status)) healthy++;
    else toFix++;
  }
  return { total: list.length, healthy, toFix, notApplicable };
}
