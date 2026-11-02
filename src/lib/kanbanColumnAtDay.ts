import type { KanbanStatsItem } from "@/types/kanban";

/**
 * Column an item occupied at the end of a given day.
 * Closed items enter their done column on their closure date. Before that, the
 * recorded move history is replayed; without history, closed items fall back to
 * the entry column and open items to their current column.
 */
export function columnAtDay(
  item: KanbanStatsItem,
  dayEnd: Date,
  entryColumnId: string | undefined,
): string | null {
  if (new Date(item.createdAt) > dayEnd) return null;
  if (item.completedAt && new Date(item.completedAt) <= dayEnd) return item.columnId;
  const moves = item.moves ?? [];
  let col: string | null = null;
  for (const m of moves) {
    if (new Date(m.at) <= dayEnd) col = m.to;
    else break;
  }
  if (col) return col;
  if (moves[0]?.from) return moves[0].from;
  return item.completedAt ? (entryColumnId ?? item.columnId) : item.columnId;
}
