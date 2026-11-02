import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FollowupFormation { id: string; formation_name: string }
export interface FollowupFormula { id: string; name: string; prix: number | null; duree_heures: number | null; coaching_sessions_count: number | null }

export function useActiveFormations() {
  return useQuery({
    queryKey: ["followup-active-formations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("formation_configs")
        .select("id, formation_name")
        .eq("is_active", true)
        .order("formation_name");
      if (error) throw error;
      return (data || []) as FollowupFormation[];
    },
    refetchOnWindowFocus: false,
  });
}

export function useFormationFormulaOptions(formationId: string) {
  return useQuery({
    queryKey: ["followup-formation-formulas", formationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("formation_formulas")
        .select("id, name, prix, duree_heures, coaching_sessions_count")
        .eq("formation_config_id", formationId)
        .order("display_order");
      if (error) throw error;
      return (data || []) as FollowupFormula[];
    },
    enabled: !!formationId,
    refetchOnWindowFocus: false,
  });
}
