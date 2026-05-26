// Helper to check learner email notification preferences.
// Defaults to TRUE (opt-out model) when no profile row exists.

export type LearnerNotifKey =
  | "email_notif_work_reply"
  | "email_notif_work_comment"
  | "email_notif_live"
  | "email_notif_important";

export async function learnerHasNotifEnabled(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  email: string | null | undefined,
  key: LearnerNotifKey,
): Promise<boolean> {
  if (!email) return true;
  try {
    const { data } = await supabase
      .from("learner_profiles")
      .select(key)
      .eq("email", email.toLowerCase())
      .maybeSingle();
    if (!data) return true;
    const val = (data as Record<string, unknown>)[key];
    // null/undefined => default true; explicit false => disabled
    return val !== false;
  } catch (err) {
    console.warn("[learner-prefs] lookup failed, defaulting to enabled:", err);
    return true;
  }
}
