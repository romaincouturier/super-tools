import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MissionDraftLinks {
  missionTitle: string | null;
  opportunityId: string | null;
  opportunityTitle: string | null;
}

const sb = supabase as any;

/**
 * For a list of mission ids, fetch the mission title and the linked CRM card
 * (the "opportunity") so each email draft can be displayed with clickable links
 * to its mission and opportunity.
 */
export function useMissionDraftLinks(missionIds: string[]) {
  const sortedIds = [...new Set(missionIds)].sort();
  return useQuery({
    queryKey: ["mission-draft-links", sortedIds],
    queryFn: async () => {
      const map = new Map<string, MissionDraftLinks>();
      if (sortedIds.length === 0) return map;

      const [missionsRes, cardsRes] = await Promise.all([
        sb.from("missions").select("id, title").in("id", sortedIds),
        sb
          .from("crm_cards")
          .select("id, title, linked_mission_id")
          .in("linked_mission_id", sortedIds),
      ]);

      const missionsById = new Map<string, { id: string; title: string }>(
        ((missionsRes.data as { id: string; title: string }[]) || []).map((m) => [m.id, m]),
      );
      const cardByMission = new Map<string, { id: string; title: string }>();
      ((cardsRes.data as { id: string; title: string; linked_mission_id: string }[]) || []).forEach((c) => {
        if (c.linked_mission_id && !cardByMission.has(c.linked_mission_id)) {
          cardByMission.set(c.linked_mission_id, { id: c.id, title: c.title });
        }
      });

      sortedIds.forEach((id) => {
        const mission = missionsById.get(id);
        const card = cardByMission.get(id);
        map.set(id, {
          missionTitle: mission?.title || null,
          opportunityId: card?.id || null,
          opportunityTitle: card?.title || null,
        });
      });
      return map;
    },
    enabled: sortedIds.length > 0,
  });
}
