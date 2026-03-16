import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CrmColumn, CrmCard, CrmTag } from "@/types/crm";
import { CRM_QUERY_KEY } from "./useCrmMutation";

export const useCrmReports = () => {
  return useQuery({
    queryKey: [CRM_QUERY_KEY, "reports"],
    queryFn: async () => {
      const [columnsRes, cardsRes, tagsRes, cardTagsRes] = await Promise.all([
        supabase.from("crm_columns").select("*").eq("is_archived", false).order("position"),
        supabase.from("crm_cards").select("*"),
        supabase.from("crm_tags").select("*"),
        supabase.from("crm_card_tags").select("*"),
      ]);

      const columns = (columnsRes.data || []) as unknown as CrmColumn[];
      const cards = (cardsRes.data || []) as unknown as CrmCard[];
      const tags = (tagsRes.data || []) as unknown as CrmTag[];
      const cardTags = cardTagsRes.data || [];

      const cardsPerColumn = columns.map((col) => ({
        columnName: col.name,
        count: cards.filter((c) => c.column_id === col.id).length,
      }));

      const wonCards = cards.filter((c) => c.sales_status === "WON");
      const lostCards = cards.filter((c) => c.sales_status === "LOST");
      const openCards = cards.filter((c) => c.sales_status === "OPEN");

      const categories = [...new Set(tags.filter((t) => t.category).map((t) => t.category))];
      const breakdownByCategory = categories.map((cat) => {
        const categoryTagIds = tags.filter((t) => t.category === cat).map((t) => t.id);
        const uniqueCardIds = [
          ...new Set(
            cardTags.filter((ct) => categoryTagIds.includes(ct.tag_id)).map((ct) => ct.card_id)
          ),
        ];
        return {
          category: cat,
          count: uniqueCardIds.length,
          totalValue: cards
            .filter((c) => uniqueCardIds.includes(c.id))
            .reduce((sum, c) => sum + (c.estimated_value || 0), 0),
        };
      });

      return {
        cardsPerColumn,
        wonCount: wonCards.length,
        wonValue: wonCards.reduce((sum, c) => sum + (c.estimated_value || 0), 0),
        lostCount: lostCards.length,
        openValue: openCards.reduce((sum, c) => sum + (c.estimated_value || 0), 0),
        openCount: openCards.length,
        breakdownByCategory,
        totalCards: cards.length,
      };
    },
  });
};
