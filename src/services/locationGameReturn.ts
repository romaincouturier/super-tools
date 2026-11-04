import { supabase } from "@/integrations/supabase/client";

export async function confirmLocationGameReturn(id: string) {
  const { data, error } = await (supabase as any)
    .from("order_items")
    .update({ location_returned_at: new Date().toISOString(), kanban_status: "processed" })
    .eq("id", id)
    .eq("game_type", "location")
    .is("location_returned_at", null)
    .is("archived_at", null)
    .select("id, location_returned_at, kanban_status")
    .single();
  if (error) throw error;
  return data as { id: string; location_returned_at: string; kanban_status: "processed" };
}