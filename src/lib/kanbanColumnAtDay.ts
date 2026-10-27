import type { KanbanStatsItem } from "@/types/kanban";

/**
 * Column an item occupied at the end of a given day.
 * Closed items enter their done column on their closure date. Before that, the
 * recorded move history is replayed; without history, the entry column is used.
 */
export function columnAtDay(
  item: KanbanStatsItem,
  dayEnd: Date,
  entryColumnId: string | undefined,
): string | null {
  if (new Date(item.createdAt) > dayEnd) return null;
  const closedLater = item.completedAt && new Date(item.completedAt) > dayEnd;
  if (!item.completedAt || !closedLater) {
    if (!item.completedAt) {
      // Open item: current column is authoritative for today, history for the past.
      if (!item.moves?.length) return item.columnId;
    } else {
      return item.columnId;
    }
  }
  const moves = item.moves ?? [];
  let col: string | null = null;
  for (const m of moves) {
    if (new Date(m.at) <= dayEnd) col = m.to;
    else break;
  }
  if (col) return col;
  const firstFrom = moves[0]?.from;
  if (firstFrom) return firstFrom;
  return item.completedAt ? (entryColumnId ?? item.columnId) : item.columnId;
}
