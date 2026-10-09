// deno-lint-ignore-file no-explicit-any
/**
 * Réservation atomique d'un rappel de live pour (live, participant).
 * La clé primaire de live_reminder_sends garantit qu'un seul déclencheur
 * (cron quotidien ou email programmé) obtient le droit d'envoyer.
 */
export async function claimLiveReminder(
  supabase: any,
  liveMeetingId: string,
  participantId: string,
  source: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("live_reminder_sends")
    .upsert(
      { live_meeting_id: liveMeetingId, participant_id: participantId, source },
      { onConflict: "live_meeting_id,participant_id", ignoreDuplicates: true },
    )
    .select("live_meeting_id");
  if (error) throw new Error(`live_reminder_sends: ${error.message}`);
  return Array.isArray(data) && data.length > 0;
}

/** Libère la réservation si l'envoi a échoué, pour permettre une nouvelle tentative. */
export async function releaseLiveReminder(
  supabase: any,
  liveMeetingId: string,
  participantId: string,
): Promise<void> {
  await supabase
    .from("live_reminder_sends")
    .delete()
    .eq("live_meeting_id", liveMeetingId)
    .eq("participant_id", participantId);
}
