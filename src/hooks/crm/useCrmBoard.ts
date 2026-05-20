import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  mapColumns,
  mapTags,
  mapCards,
} from "@/lib/crmDataTransform";
import { CRM_QUERY_KEY } from "./useCrmMutation";

const CRM_PAGE_SIZE = 1000;

const fetchAllCardTags = async () => {
  const rows = [];

  for (let from = 0; ; from += CRM_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("crm_card_tags")
      .select("*")
      .order("created_at", { ascending: true })
      .range(from, from + CRM_PAGE_SIZE - 1);

    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < CRM_PAGE_SIZE) break;
  }

  return rows;
};

/** Fetch all board data: columns, cards, tags. */
export const useCrmBoard = () => {
  return useQuery({
    queryKey: [CRM_QUERY_KEY],
    queryFn: async () => {
      // Run all 4 queries in parallel for speed
      const [columnsRes, cardsRes, tagsRes, cardTagRows] = await Promise.all([
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
        fetchAllCardTags(),
      ]);

      if (columnsRes.error) throw columnsRes.error;
      if (cardsRes.error) throw cardsRes.error;
      if (tagsRes.error) throw tagsRes.error;

      const columns = mapColumns(columnsRes.data || []);
      const tags = mapTags(tagsRes.data || []);
      const cards = mapCards(cardsRes.data || [], cardTagRows, tags);

      return { columns, cards, tags };
    },
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    staleTime: 30_000,
  });
};
