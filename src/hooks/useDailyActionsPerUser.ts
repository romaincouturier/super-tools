import { useQuery } from "@tanstack/react-query";
import {
  fetchDailyActionsPerUser,
  type DailyActionsPerUserRow,
} from "@/services/dailyActionsPerUser";

export interface WeeklyPersonPoint {
  week: string;
  [person: string]: string | number;
}

export interface DailyActionsPerUserData {
  weeks: WeeklyPersonPoint[];
  people: string[];
}

const MAX_PEOPLE = 6;

export function buildChartData(rows: DailyActionsPerUserRow[]): DailyActionsPerUserData {
  const totals = new Map<string, number>();
  for (const r of rows) {
    totals.set(r.display_name, (totals.get(r.display_name) ?? 0) + r.total_actions);
  }
  const people = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_PEOPLE)
    .map(([name]) => name);
  const kept = new Set(people);

  const byWeek = new Map<string, WeeklyPersonPoint>();
  for (const r of rows) {
    const key = r.week_start;
    let point = byWeek.get(key);
    if (!point) {
      point = { week: key };
      byWeek.set(key, point);
    }
    const bucket = kept.has(r.display_name) ? r.display_name : "Autres";
    point[bucket] = ((point[bucket] as number) ?? 0) + r.total_actions;
  }

  const weeks = [...byWeek.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, point]) => point);
  if (totals.size > MAX_PEOPLE) people.push("Autres");

  return { weeks, people };
}

export function useDailyActionsPerUser(enabled: boolean, weeks = 12) {
  return useQuery({
    queryKey: ["daily-actions-per-user", weeks],
    queryFn: async () => buildChartData(await fetchDailyActionsPerUser(weeks)),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
