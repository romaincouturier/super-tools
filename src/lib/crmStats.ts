import { startOfDay } from "date-fns";
import type { CrmCard } from "@/types/crm";
import type { KanbanStatsItem, KanbanStatsMove } from "@/types/kanban";

export const STATS_WON_COL_ID = "__stats_won__";
export const STATS_LOST_COL_ID = "__stats_lost__";

export function crmStatsItem(
  card: Pick<CrmCard, "id" | "sales_status" | "column_id" | "created_at" | "won_at" | "lost_at" | "estimated_value">,
  moves: KanbanStatsMove[],
  now = new Date(),
): KanbanStatsItem {
  return {
    id: card.id,
    columnId: card.sales_status === "WON" ? STATS_WON_COL_ID
      : card.sales_status === "LOST" ? STATS_LOST_COL_ID : card.column_id,
    createdAt: card.created_at,
    completedAt: card.sales_status === "WON" ? card.won_at
      : card.sales_status === "LOST" ? card.lost_at : null,
    currentColumnAsOf: startOfDay(now).toISOString(),
    value: card.estimated_value,
    moves,
  };
}