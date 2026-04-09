import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  mapColumns,
  mapTags,
  mapCards,
} from "@/lib/crmDataTransform";
import { CRM_QUERY_KEY } from "./useCrmMutation";

/** Fetch all board data: columns, cards, tags. */
export const useCrmBoard = () => {
  return useQuery({
    queryKey: [CRM_QUERY_KEY],
    queryFn: async () => {
      // Run all 4 queries in parallel for speed
      const [columnsRes, cardsRes, tagsRes, cardTagsRes] = await Promise.all([
        supabase
          .from("crm_columns")
          .select("*")
          .eq("is_archived", false)
          .order("position", { ascending: true }),
        supabase
          .from("crm_cards")
          .select("*")
          .order("position", { ascending: true }),
        supabase
          .from("crm_tags")
          .select("*")
          .order("category", { ascending: true }),
        supabase.from("crm_card_tags").select("*"),
      ]);

      if (columnsRes.error) throw columnsRes.error;
      if (cardsRes.error) throw cardsRes.error;
      if (tagsRes.error) throw tagsRes.error;
      if (cardTagsRes.error) throw cardTagsRes.error;

      const columns = mapColumns(columnsRes.data || []);
      const tags = mapTags(tagsRes.data || []);
      const cards = mapCards(cardsRes.data || [], cardTagsRes.data || [], tags);

      return { columns, cards, tags };
    },
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    staleTime: 30_000,
  });
};
