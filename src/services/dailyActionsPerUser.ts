import { supabase } from "@/integrations/supabase/client";

export interface DailyActionsPerUserRow {
  user_id: string;
  display_name: string;
  week_start: string;
  total_actions: number;
  completed_actions: number;
}

export async function fetchDailyActionsPerUser(
  weeks = 12
): Promise<DailyActionsPerUserRow[]> {
  const { data, error } = await supabase.rpc("get_daily_actions_per_user", {
    p_weeks: weeks,
  } as any);
  if (error) throw error;
  return (data ?? []) as DailyActionsPerUserRow[];
}
