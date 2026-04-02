import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CrmColumn, CrmCard, CrmTag } from "@/types/crm";
import { CRM_QUERY_KEY } from "./useCrmMutation";

export interface CrmReportFilters {
  startDate: string | null; // ISO date
  endDate: string | null;
}

export const useCrmReports = (filters?: CrmReportFilters) => {
  return useQuery({
    queryKey: [CRM_QUERY_KEY, "reports", filters?.startDate, filters?.endDate],
    queryFn: async () => {
      const [columnsRes, cardsRes, tagsRes, cardTagsRes] = await Promise.all([
        supabase.from("crm_columns").select("*").eq("is_archived", false).order("position"),
        supabase.from("crm_cards").select("*"),
        supabase.from("crm_tags").select("*"),
        supabase.from("crm_card_tags").select("*"),
      ]);

      if (columnsRes.error) throw columnsRes.error;
      if (cardsRes.error) throw cardsRes.error;
      if (tagsRes.error) throw tagsRes.error;
      if (cardTagsRes.error) throw cardTagsRes.error;

      const columns = (columnsRes.data || []) as unknown as CrmColumn[];
      const allCards = (cardsRes.data || []) as unknown as CrmCard[];
      const tags = (tagsRes.data || []) as unknown as CrmTag[];
      const cardTags = cardTagsRes.data || [];

      // Apply date filter — WON/LOST use their temporal fields, OPEN uses created_at
      const inPeriod = (card: CrmCard) => {
        if (!filters?.startDate && !filters?.endDate) return true;
        const refDate = card.sales_status === "WON" ? card.won_at
          : card.sales_status === "LOST" ? card.lost_at
          : card.created_at;
        if (!refDate) return true;
        const d = refDate.slice(0, 10);
        if (filters.startDate && d < filters.startDate) return false;
        if (filters.endDate && d > filters.endDate) return false;
        return true;
      };

      const cards = allCards.filter(inPeriod);

      const wonCards = cards.filter((c) => c.sales_status === "WON");
      const lostCards = cards.filter((c) => c.sales_status === "LOST");
      const openCards = cards.filter((c) => c.sales_status === "OPEN");

      // Weighted pipeline (confidence_score * estimated_value)
      const weightedPipeline = openCards.reduce((sum, c) => {
        const value = c.estimated_value || 0;
        const confidence = (c.confidence_score ?? 50) / 100;
        return sum + value * confidence;
      }, 0);

      // Tag → card mapping for pivot table
      const tagById = new Map(tags.map((t) => [t.id, t]));
      const cardTagMap = new Map<string, string[]>();
      for (const ct of cardTags) {
        const existing = cardTagMap.get(ct.card_id) || [];
        existing.push(ct.tag_id);
        cardTagMap.set(ct.card_id, existing);
      }

      // Enrich cards with tags for pivot
      const cardsWithTags = cards.map((c) => ({
        ...c,
        tagObjects: (cardTagMap.get(c.id) || []).map((tid) => tagById.get(tid)).filter(Boolean) as CrmTag[],
      }));

      // Get all unique tag categories
      const categories = [...new Set(tags.filter((t) => t.category).map((t) => t.category!))].sort();

      return {
        // KPIs
        wonCount: wonCards.length,
        wonValue: wonCards.reduce((sum, c) => sum + (c.estimated_value || 0), 0),
        lostCount: lostCards.length,
        lostValue: lostCards.reduce((sum, c) => sum + (c.estimated_value || 0), 0),
        openCount: openCards.length,
        openValue: openCards.reduce((sum, c) => sum + (c.estimated_value || 0), 0),
        weightedPipeline,
        totalCards: cards.length,
        // Pivot data
        tags,
        categories,
        cardsWithTags,
        columns,
      };
    },
  });
};
