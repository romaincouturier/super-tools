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

      // Pipeline pivot: OPEN cards only (no date filter — always full pipeline)
      const pipelineCards = allCards.filter((c) => c.sales_status === "OPEN");
      const pipelineCardsWithTags = pipelineCards.map((c) => ({
        ...c,
        tagObjects: (cardTagMap.get(c.id) || []).map((tid) => tagById.get(tid)).filter(Boolean) as CrmTag[],
      }));

      // Get all unique tag categories
      const categories = [...new Set(tags.filter((t) => t.category).map((t) => t.category!))].sort();

      // ── Weekly time series (last 12 weeks) ────────────────
      const weeklyData = buildWeeklyTimeSeries(allCards);

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
        pipelineCardsWithTags,
        columns,
        weeklyData,
      };
    },
  });
};

// ── Weekly time series builder ──────────────────────────────

export interface WeeklyPoint {
  week: string; // "dd/MM" label
  weekStart: string; // ISO date
  openValue: number;
  weightedValue: number;
  wonValue: number;
  lostValue: number;
  wonCount: number;
  lostCount: number;
  conversionRate: number;
}

function buildWeeklyTimeSeries(allCards: CrmCard[]): WeeklyPoint[] {
  const now = new Date();
  const weeks: { start: Date; end: Date }[] = [];

  // Generate last 12 week boundaries (Monday to Sunday)
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay() + 1 - i * 7); // Monday of week
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    weeks.push({ start, end });
  }

  return weeks.map(({ start, end }) => {
    const endStr = end.toISOString().slice(0, 10);
    const startStr = start.toISOString().slice(0, 10);

    let openValue = 0;
    let weightedValue = 0;
    let wonValue = 0;
    let lostValue = 0;
    let wonCount = 0;
    let lostCount = 0;

    for (const card of allCards) {
      const val = card.estimated_value || 0;
      const created = (card.created_at || "").slice(0, 10);
      const won = card.won_at?.slice(0, 10) ?? null;
      const lost = card.lost_at?.slice(0, 10) ?? null;

      // Won this week?
      if (won && won >= startStr && won <= endStr) {
        wonValue += val;
        wonCount++;
      }

      // Lost this week?
      if (lost && lost >= startStr && lost <= endStr) {
        lostValue += val;
        lostCount++;
      }

      // Was this card open at end of this week?
      if (created <= endStr) {
        const wasWon = won && won <= endStr;
        const wasLost = lost && lost <= endStr;
        if (!wasWon && !wasLost) {
          openValue += val;
          const confidence = (card.confidence_score ?? 50) / 100;
          weightedValue += val * confidence;
        }
      }
    }

    const conversionRate = wonCount + lostCount > 0
      ? Math.round((wonCount / (wonCount + lostCount)) * 100)
      : 0;

    const label = `${start.getDate().toString().padStart(2, "0")}/${(start.getMonth() + 1).toString().padStart(2, "0")}`;

    return {
      week: label,
      weekStart: startStr,
      openValue,
      weightedValue,
      wonValue,
      lostValue,
      wonCount,
      lostCount,
      conversionRate,
    };
  });
}
