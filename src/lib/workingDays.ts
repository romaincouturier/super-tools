import { addDays, subDays } from "date-fns";
import type { supabase } from "@/integrations/supabase/client";

type SupabaseLike = typeof supabase;

/**
 * Calculates a target date by subtracting working days from a given date.
 * @param fromDate The starting date
 * @param daysToSubtract Number of working days to subtract (positive number)
 * @param workingDays Array of 7 booleans representing which days are working days [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
 * @returns The calculated date
 */
export function subtractWorkingDays(
  fromDate: Date,
  daysToSubtract: number,
  workingDays: boolean[] = [false, true, true, true, true, true, false]
): Date {
  let result = new Date(fromDate);
  let remainingDays = daysToSubtract;

  while (remainingDays > 0) {
    result = subDays(result, 1);
    const dayOfWeek = result.getDay();
    if (workingDays[dayOfWeek]) {
      remainingDays--;
    }
  }

  return result;
}

/**
 * Calculates a target date by adding working days to a given date.
 * @param fromDate The starting date
 * @param daysToAdd Number of working days to add (positive number)
 * @param workingDays Array of 7 booleans representing which days are working days [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
 * @returns The calculated date
 */
export function addWorkingDays(
  fromDate: Date,
  daysToAdd: number,
  workingDays: boolean[] = [false, true, true, true, true, true, false]
): Date {
  let result = new Date(fromDate);
  let remainingDays = daysToAdd;

  while (remainingDays > 0) {
    result = addDays(result, 1);
    const dayOfWeek = result.getDay();
    if (workingDays[dayOfWeek]) {
      remainingDays--;
    }
  }

  return result;
}

/**
 * Fetches working days configuration from app_settings
 */
export async function fetchWorkingDays(supabase: SupabaseLike): Promise<boolean[]> {
  const defaultWorkingDays = [false, true, true, true, true, true, false];
  
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
    console.error("Error fetching working days:", error);
  }

  return defaultWorkingDays;
}

/**
 * Fetches the delay for needs survey from app_settings
 */
export async function fetchNeedsSurveyDelay(supabase: SupabaseLike): Promise<number> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "delay_needs_survey_days")
      .single();

    if (data?.setting_value) {
      return parseInt(data.setting_value, 10) || 7;
    }
  } catch (error) {
    console.error("Error fetching needs survey delay:", error);
  }

  return 7; // Default 7 days
}

/**
 * Fetches the delay for trainer summary from app_settings
 */
export async function fetchTrainerSummaryDelay(supabase: SupabaseLike): Promise<number> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "delay_trainer_summary_days")
      .single();

    if (data?.setting_value) {
      return parseInt(data.setting_value, 10) || 1;
    }
  } catch (error) {
    console.error("Error fetching trainer summary delay:", error);
  }

  return 1; // Default 1 day before
}

/**
 * Schedules a trainer_summary email if none exists yet for this training.
 * Should be called after adding participants.
 */
export async function scheduleTrainerSummaryIfNeeded(
  supabase: SupabaseLike,
  trainingId: string,
  trainingStartDate: string
): Promise<void> {
  try {
    // Check if trainer_summary already scheduled
    const { data: existing } = await supabase
      .from("scheduled_emails")
      .select("id")
      .eq("training_id", trainingId)
      .eq("email_type", "trainer_summary")
      .limit(1);

    if (existing && existing.length > 0) return;

    const [workingDays, delay] = await Promise.all([
      fetchWorkingDays(supabase),
      fetchTrainerSummaryDelay(supabase),
    ]);

    const startDate = new Date(trainingStartDate + "T00:00:00");
    const scheduledDate = subtractWorkingDays(startDate, delay, workingDays);

    // Schedule at 7:00 AM UTC
    if (scheduledDate > new Date()) {
      const { format } = await import("date-fns");
      await supabase.from("scheduled_emails").insert({
        training_id: trainingId,
        email_type: "trainer_summary",
        scheduled_for: format(scheduledDate, "yyyy-MM-dd'T'07:00:00"),
        status: "pending",
      });
      console.log("Trainer summary email scheduled for", format(scheduledDate, "yyyy-MM-dd"));
    }
  } catch (error) {
    console.error("Failed to schedule trainer summary:", error);
  }
}
