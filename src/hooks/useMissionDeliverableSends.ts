/**
 * Historique des envois de livrables d'une mission.
 *
 * Vit dans un hook et non dans le composant : règle [014b], aucun accès direct
 * à supabase depuis `src/components`. Sert à savoir, pour un contact donné, ce
 * qu'il a déjà reçu et ce qui est nouveau depuis.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MissionDeliverableSend {
  contact_id: string | null;
  email: string;
  item_keys: string[];
  sent_at: string;
}

export const useMissionDeliverableSends = (missionId: string | undefined, enabled = true) =>
  useQuery({
    queryKey: ["mission-deliverable-sends", missionId],
    enabled: enabled && !!missionId,
    queryFn: async (): Promise<MissionDeliverableSend[]> => {
      const { data, error } = await supabase
        .from("mission_deliverable_sends")
        .select("contact_id, email, item_keys, sent_at")
        .eq("mission_id", missionId!)
        .order("sent_at", { ascending: false });
      if (error) throw error;
      return (data || []) as MissionDeliverableSend[];
    },
  });
