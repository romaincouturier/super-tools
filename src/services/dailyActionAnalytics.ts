import { supabase } from "@/integrations/supabase/client";
import {
  CATEGORIES,
  type CategoryAnalytics,
  type DailyAnalytics,
  type DailyAction,
} from "@/lib/dailyActionConstants";

// ── Raw row shape coming from Supabase ──

interface AnalyticsRow {
  category_stats: unknown;
  total_actions: number | null;
  completed_count: number | null;
}

interface AggregatedEntry {
  totalMinutes: number;
  count: number;
  totalActions: number;
  totalCompleted: number;
}

// ── Queries ──

/** Fetch today's daily actions for a given user. */
export async function fetchDailyActions(
  userId: string,
  actionDate: string
): Promise<DailyAction[]> {
  const { data, error } = await supabase
    .from("daily_actions")
    .select(
      "id, category, title, description, link, is_completed, completed_at, auto_completed"
    )
    .eq("user_id", userId)
    .eq("action_date", actionDate)
    .order("category")
    .order("is_completed")
    .order("title");

  if (error) throw error;
  return (data ?? []) as DailyAction[];
}

/** Toggle the completion status of a single action. */
export async function toggleDailyAction(
  actionId: string,
  completed: boolean
): Promise<void> {
  const updatePayload: Record<string, unknown> = {
    is_completed: completed,
    completed_at: completed ? new Date().toISOString() : null,
    auto_completed: false,
  };

  const { error } = await supabase
    .from("daily_actions")
    .update(updatePayload)
    .eq("id", actionId);

  if (error) throw error;
}

/** Trigger the edge function that auto-detects completed actions. */
export async function checkDailyActionsCompletion(): Promise<void> {
  await supabase.functions.invoke("check-daily-actions-completion");
}

/** Fetch and aggregate analytics for the last 30 days. */
export async function fetchDailyAnalytics(
  userId: string
): Promise<DailyAnalytics | null> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fromDate = thirtyDaysAgo.toISOString().split("T")[0];

  const { data } = await supabase
    .from("daily_action_analytics")
    .select("category_stats, total_actions, completed_count")
    .eq("user_id", userId)
    .gte("action_date", fromDate)
    .order("action_date", { ascending: false });

  if (!data || data.length === 0) return null;

  return aggregateAnalytics(data as AnalyticsRow[]);
}

// ── Data transformation ──

function aggregateAnalytics(rows: AnalyticsRow[]): DailyAnalytics {
  const aggregated: Record<string, AggregatedEntry> = {};

  for (const day of rows) {
    const stats = day.category_stats as Record<string, CategoryAnalytics> | null;
    if (!stats) continue;

    for (const [cat, catStats] of Object.entries(stats)) {
      if (!aggregated[cat]) {
        aggregated[cat] = { totalMinutes: 0, count: 0, totalActions: 0, totalCompleted: 0 };
      }
      aggregated[cat].totalActions += catStats.total || 0;
      aggregated[cat].totalCompleted += catStats.completed || 0;
      if (
        catStats.avg_completion_minutes !== null &&
        catStats.avg_completion_minutes >= 0
      ) {
        aggregated[cat].totalMinutes += catStats.avg_completion_minutes;
        aggregated[cat].count++;
      }
    }
  }

  const categoryStats: Record<string, CategoryAnalytics> = {};
  for (const [cat, agg] of Object.entries(aggregated)) {
    categoryStats[cat] = {
      label: CATEGORIES[cat]?.label || cat,
      avg_completion_minutes:
        agg.count > 0 ? Math.round(agg.totalMinutes / agg.count) : null,
      total: agg.totalActions,
      completed: agg.totalCompleted,
    };
  }

  const totalActions = rows.reduce(
    (sum, d) => sum + (d.total_actions || 0),
    0
  );
  const completedCount = rows.reduce(
    (sum, d) => sum + (d.completed_count || 0),
    0
  );

  return {
    total_actions: totalActions,
    completed_count: completedCount,
    category_stats: categoryStats,
  };
}
