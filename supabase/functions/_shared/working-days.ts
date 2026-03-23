/**
 * Default working days: Mon–Fri (index 0 = Sunday)
 */
const DEFAULT_WORKING_DAYS = [false, true, true, true, true, true, false];

/**
 * Fetches the working_days configuration from app_settings.
 * Returns an array of 7 booleans [Sun, Mon, Tue, Wed, Thu, Fri, Sat].
 */
// deno-lint-ignore no-explicit-any
export async function fetchWorkingDays(
  supabase: any,
): Promise<boolean[]> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "working_days")
      .single();

    if (data?.setting_value) {
      const parsed = JSON.parse(data.setting_value);
      if (Array.isArray(parsed) && parsed.length === 7) {
        return parsed;
      }
    }
  } catch (error) {
    console.error("[working-days] Error fetching working days config:", error);
  }

  return DEFAULT_WORKING_DAYS;
}

/**
 * Checks if the current date (in Europe/Paris timezone) is a working day.
 * Returns true if today is a working day, false otherwise.
 */
// deno-lint-ignore no-explicit-any
export async function isTodayWorkingDay(
  supabase: any,
): Promise<boolean> {
  const workingDays = await fetchWorkingDays(supabase);

  // Get current day-of-week in Paris timezone (0 = Sunday, 6 = Saturday)
  const now = new Date();
  const parisDay = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    weekday: "short",
  }).format(now);

  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  const dayIndex = dayMap[parisDay] ?? 0;
  return workingDays[dayIndex];
}

/**
 * Guard for reminder functions: if today is not a working day, returns an
 * early Response. Otherwise returns null so the caller can continue.
 *
 * Usage:
 * ```ts
 * const skip = await skipIfNonWorkingDay(supabase, "process-today-reminders");
 * if (skip) return skip;
 * ```
 */
export async function skipIfNonWorkingDay(
  supabase: ReturnType<typeof createClient>,
  functionName: string,
  corsHeaders: Record<string, string> = {},
): Promise<Response | null> {
  const isWorking = await isTodayWorkingDay(supabase);

  if (!isWorking) {
    console.log(`[${functionName}] Skipping: today is not a working day`);
    return new Response(
      JSON.stringify({
        success: true,
        skipped: true,
        reason: "non-working day",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return null;
}
