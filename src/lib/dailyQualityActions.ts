import type { DailyAction } from './dailyActionConstants';

export const PERSISTENT_DAILY_CATEGORIES = ['qualiopi', 'watch_sources_validate', 'watch_sources_subscribe'];

export function visibleDailyActions<T extends DailyAction & { action_date: string; entity_type: string | null; entity_id: string | null }>(rows: T[], today: string): T[] {
  const seen = new Set<string>();
  return rows.filter(row => {
    if (!PERSISTENT_DAILY_CATEGORIES.includes(row.category)) return row.action_date === today;
    if (row.is_completed) return false;
    const key = `${row.category}|${row.entity_type}|${row.entity_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}