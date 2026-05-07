import { differenceInCalendarDays } from "date-fns";
import type { KanbanStatsItem } from "@/types/kanban";

/**
 * Mean cycle time in calendar days for all completed items.
 * Mirrors the formula used in KanbanStatsDialog's control chart.
 * Returns 0 when there are no completed items yet.
 */
export function computeMeanCycleTime(items: KanbanStatsItem[], doneColumnIds: string[]): number {
  const completedItems = items.filter(
    (item) => doneColumnIds.includes(item.columnId) && item.completedAt,
  );
  if (completedItems.length === 0) return 0;
  const cycleTimes = completedItems.map((item) =>
    Math.max(0, differenceInCalendarDays(new Date(item.completedAt!), new Date(item.createdAt))),
  );
  return cycleTimes.reduce((s, t) => s + t, 0) / cycleTimes.length;
}

/** Number of calendar days since a card was created (always ≥ 0). */
export function cardAgeDays(createdAt: string): number {
  return Math.max(0, differenceInCalendarDays(new Date(), new Date(createdAt)));
}
