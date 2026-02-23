import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CrmColumn, CrmCard, CrmTag } from "@/types/crm";
import { fetchBoardData, fetchCardDetails } from "@/data/crm";

export const CRM_QUERY_KEY = "crm-board";

export interface ServiceTypeColors {
  formation: string;
  mission: string;
  default: string;
}

// Fetch all board data
export const useCrmBoard = () => {
  return useQuery({
    queryKey: [CRM_QUERY_KEY],
    queryFn: fetchBoardData,
  });
};

// Fetch card details (attachments, comments, activity, emails)
export const useCrmCardDetails = (cardId: string | null) => {
  return useQuery({
    queryKey: [CRM_QUERY_KEY, "card-details", cardId],
    queryFn: () => fetchCardDetails(cardId!),
    enabled: !!cardId,
  });
};

// Reporting queries
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
      const wonCount = wonCards.length;
      const wonValue = wonCards.reduce((sum, c) => sum + (c.estimated_value || 0), 0);

      const lostCards = cards.filter((c) => c.sales_status === "LOST");
      const lostCount = lostCards.length;

      const openCards = cards.filter((c) => c.sales_status === "OPEN");
      const openValue = openCards.reduce((sum, c) => sum + (c.estimated_value || 0), 0);

      const categories = [...new Set(tags.filter((t) => t.category).map((t) => t.category))];
      const breakdownByCategory = categories.map((cat) => {
        const categoryTags = tags.filter((t) => t.category === cat);
        const categoryTagIds = categoryTags.map((t) => t.id);
        const cardIdsWithCategory = cardTags
          .filter((ct) => categoryTagIds.includes(ct.tag_id))
          .map((ct) => ct.card_id);
        const uniqueCardIds = [...new Set(cardIdsWithCategory)];
        return {
          category: cat,
          count: uniqueCardIds.length,
          value: cards
            .filter((c) => uniqueCardIds.includes(c.id))
            .reduce((sum, c) => sum + (c.estimated_value || 0), 0),
        };
      });

      return {
        cardsPerColumn,
        wonCount,
        wonValue,
        lostCount,
        openValue,
        openCount: openCards.length,
        breakdownByCategory,
        totalCards: cards.length,
      };
    },
  });
};

// Fetch CRM settings
export const useCrmSettings = () => {
  return useQuery({
    queryKey: [CRM_QUERY_KEY, "settings"],
    queryFn: async () => {
      const { data, error } = (await supabase
        .from("crm_settings" as "crm_cards")
        .select("*")
        .in("setting_key" as "title", ["service_type_colors"])) as unknown as {
        data: { setting_key: string; setting_value: unknown }[] | null;
        error: Error | null;
      };

      if (error) throw error;

      const settings: Record<string, unknown> = {};
      (data || []).forEach((row) => {
        settings[row.setting_key] = row.setting_value;
      });

      return {
        serviceTypeColors: (settings.service_type_colors || {
          formation: "#3b82f6",
          mission: "#8b5cf6",
          default: "#6b7280",
        }) as ServiceTypeColors,
      };
    },
  });
};
