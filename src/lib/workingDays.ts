import { addDays, subDays } from "date-fns";

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
export async function fetchWorkingDays(supabase: any): Promise<boolean[]> {
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
export async function fetchNeedsSurveyDelay(supabase: any): Promise<number> {
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
