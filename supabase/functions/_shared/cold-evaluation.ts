// Pure helpers for cold evaluations (sponsor and participant), shared by
// send-thank-you-email (planning) and force-send-scheduled-email (sending).

export const MISSING_SPONSOR_EMAIL_MESSAGE =
  "Email du commanditaire manquant : l'évaluation à froid partira automatiquement dès qu'il sera renseigné";

export const COLD_EVALUATION_TYPES = [
  "cold_evaluation",
  "cold_evaluation_reminder",
  "participant_cold_evaluation",
  "participant_cold_evaluation_reminder",
] as const;

export const COLD_EVALUATION_GO_LIVE_DATE = "2026-11-02";

export function isColdEvaluationType(emailType: string): boolean {
  return COLD_EVALUATION_TYPES.some((type) => type === emailType);
}

export function isColdEvaluationEligible(endDate?: string | null): boolean {
  return typeof endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(endDate) && endDate > COLD_EVALUATION_GO_LIVE_DATE;
}

export interface ColdTraining {
  format_formation?: string | null;
  sponsor_email?: string | null;
  sponsor_first_name?: string | null;
  sponsor_last_name?: string | null;
  client_name?: string | null;
}

export interface ColdParticipant {
  id: string;
  email?: string | null;
  company?: string | null;
  sponsor_email?: string | null;
  sponsor_first_name?: string | null;
  sponsor_last_name?: string | null;
}

const norm = (v?: string | null) => (v || "").trim().toLowerCase();

/** One cold evaluation per distinct sponsor: returns participant ids (null = training-level). */
export function planSponsorColdEvaluations(training: ColdTraining, participants: ColdParticipant[]): (string | null)[] {
  const perParticipantFormats = ["inter-entreprises", "e_learning"];
  const firstByEmail = new Map<string, string>();
  for (const p of participants) {
    const e = norm(p.sponsor_email);
    if (e && !firstByEmail.has(e)) firstByEmail.set(e, p.id);
  }

  if (perParticipantFormats.includes(training.format_formation || "")) {
    return [...firstByEmail.values()];
  }
  if (norm(training.sponsor_email)) return [null];
  // No training-level sponsor: several distinct participant sponsors -> one each.
  if (firstByEmail.size > 1) return [...firstByEmail.values()];
  // Zero or one distinct sponsor: training-level, resolved at send time.
  return [null];
}

export interface SponsorRecipient {
  email: string;
  name: string;
  company: string;
}

/** Resolves who receives a sponsor cold evaluation, or null if no email is known. */
export function resolveSponsorRecipient(
  training: ColdTraining,
  participant: ColdParticipant | null,
  participants: ColdParticipant[],
): SponsorRecipient | null {
  const fullName = (f?: string | null, l?: string | null) => [f, l].filter(Boolean).join(" ");
  if (participant && norm(participant.sponsor_email)) {
    return {
      email: participant.sponsor_email!.trim(),
      name: fullName(participant.sponsor_first_name, participant.sponsor_last_name),
      company: participant.company || training.client_name || "",
    };
  }
  if (norm(training.sponsor_email)) {
    return {
      email: training.sponsor_email!.trim(),
      name: fullName(training.sponsor_first_name, training.sponsor_last_name),
      company: training.client_name || "",
    };
  }
  if (participant) return null;
  const withSponsor = participants.filter((p) => norm(p.sponsor_email));
  const distinct = new Set(withSponsor.map((p) => norm(p.sponsor_email)));
  if (distinct.size !== 1) return null;
  const p = withSponsor[0];
  return {
    email: p.sponsor_email!.trim(),
    name: fullName(p.sponsor_first_name, p.sponsor_last_name),
    company: p.company || training.client_name || "",
  };
}
