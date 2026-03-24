/**
 * State machine for convention signature workflow (edge functions).
 * Mirrors src/lib/stateMachine.ts for frontend code.
 */

export const CONVENTION_SIGNATURE_STATUSES = [
  "pending",
  "signed",
  "expired",
  "cancelled",
] as const;

export type ConventionSignatureStatus =
  (typeof CONVENTION_SIGNATURE_STATUSES)[number];

const CONVENTION_TRANSITIONS: Record<
  ConventionSignatureStatus,
  readonly ConventionSignatureStatus[]
> = {
  pending: ["signed", "expired", "cancelled"],
  signed: ["expired"],
  expired: [],
  cancelled: [],
};

export function canTransitionConventionSignature(
  from: ConventionSignatureStatus,
  to: ConventionSignatureStatus,
): boolean {
  return CONVENTION_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertConventionSignatureTransition(
  from: ConventionSignatureStatus,
  to: ConventionSignatureStatus,
): void {
  if (!canTransitionConventionSignature(from, to)) {
    throw new Error(
      `[ConventionSignature] Transition invalide : "${from}" → "${to}". ` +
        `Autorisées depuis "${from}" : ${CONVENTION_TRANSITIONS[from]?.join(", ") || "aucune"}.`,
    );
  }
}
