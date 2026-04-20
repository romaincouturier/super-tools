/**
 * Generic state machine for workflow transitions.
 * Prevents invalid state changes at compile-time (via types) and runtime (via assertions).
 */

// ---------------------------------------------------------------------------
// Generic engine
// ---------------------------------------------------------------------------

export interface StateMachineConfig<S extends string> {
  transitions: Record<S, readonly S[]>;
  label: string;
}

export function canTransition<S extends string>(
  config: StateMachineConfig<S>,
  from: S,
  to: S,
): boolean {
  return config.transitions[from]?.includes(to) ?? false;
}

export function assertTransition<S extends string>(
  config: StateMachineConfig<S>,
  from: S,
  to: S,
): void {
  if (!canTransition(config, from, to)) {
    throw new Error(
      `[${config.label}] Transition invalide : "${from}" → "${to}". ` +
        `Transitions autorisées depuis "${from}" : ${config.transitions[from]?.join(", ") || "aucune"}.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Convention Signatures
// ---------------------------------------------------------------------------

export const CONVENTION_SIGNATURE_STATUSES = [
  "pending",
  "signed",
  "expired",
  "cancelled",
] as const;

export type ConventionSignatureStatus =
  (typeof CONVENTION_SIGNATURE_STATUSES)[number];

export const conventionSignatureMachine: StateMachineConfig<ConventionSignatureStatus> =
  {
    label: "ConventionSignature",
    transitions: {
      pending: ["signed", "expired", "cancelled"],
      signed: ["expired"],
      expired: [],
      cancelled: [],
    },
  };

// ---------------------------------------------------------------------------
// Training Evaluations
// ---------------------------------------------------------------------------

export const EVALUATION_STATUSES = ["non_envoye", "envoye", "soumis"] as const;

export type EvaluationStatus = (typeof EVALUATION_STATUSES)[number];

export const evaluationMachine: StateMachineConfig<EvaluationStatus> = {
  label: "TrainingEvaluation",
  transitions: {
    non_envoye: ["soumis"],
    envoye: ["soumis"],
    soumis: [],
  },
};

// ---------------------------------------------------------------------------
// Questionnaire Besoins
// ---------------------------------------------------------------------------

export const QUESTIONNAIRE_STATUSES = [
  "non_envoye",
  "envoye",
  "accueil_envoye",
  "en_cours",
  "complete",
  "valide_formateur",
  "expire",
] as const;

export type QuestionnaireStatus = (typeof QUESTIONNAIRE_STATUSES)[number];

export const questionnaireMachine: StateMachineConfig<QuestionnaireStatus> = {
  label: "QuestionnaireBesoins",
  transitions: {
    // non_envoye → en_cours/complete autorisé pour les liens directs (WordPress, orphan, accès manuel)
    non_envoye: ["envoye", "en_cours", "complete", "expire"],
    envoye: ["accueil_envoye", "en_cours", "complete", "expire"],
    accueil_envoye: ["en_cours", "complete", "expire"],
    en_cours: ["complete", "expire"],
    complete: ["valide_formateur"],
    valide_formateur: [],
    expire: [],
  },
};
