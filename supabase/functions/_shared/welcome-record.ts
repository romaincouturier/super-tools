/* eslint-disable @typescript-eslint/no-explicit-any */
// deno-lint-ignore no-explicit-any
type Supabase = any;

/**
 * Trace la convocation dans scheduled_emails, pour que l'outil affiche la
 * date réelle d'envoi (ou l'échec) et pas seulement une date prévue. Une
 * convocation programmée encore en attente est soldée par cet envoi, sinon
 * elle repartirait à sa date.
 */
export async function recordWelcome(
  supabase: Supabase,
  trainingId: string,
  participantId: string,
  outcome: { sent: true } | { sent: false; error: string },
): Promise<void> {
  const now = new Date().toISOString();
  const fields = outcome.sent
    ? { status: "sent", sent_at: now, error_message: null }
    : { status: "failed", sent_at: null, error_message: outcome.error.slice(0, 500) };

  if (outcome.sent) {
    const { data: pending } = await supabase
      .from("scheduled_emails")
      .select("id")
      .eq("participant_id", participantId)
      .eq("email_type", "welcome")
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();
    if (pending) {
      await supabase.from("scheduled_emails").update(fields).eq("id", pending.id);
      return;
    }
  }
  await supabase.from("scheduled_emails").insert({
    training_id: trainingId,
    participant_id: participantId,
    email_type: "welcome",
    scheduled_for: now,
    ...fields,
  });
}
