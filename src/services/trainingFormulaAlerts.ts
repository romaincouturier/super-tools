import { supabase } from "@/integrations/supabase/client";

export async function fetchDailyTrainingFormulaAlerts(userId: string, today: string) {
  const { data, error } = await supabase.from("daily_actions")
    .select("id, description, entity_id")
    .eq("user_id", userId)
    .eq("action_date", today)
    .eq("category", "formations_tarifs_manquants")
    .eq("is_completed", false)
    .order("description");
  if (error) throw error;
  return data || [];
}