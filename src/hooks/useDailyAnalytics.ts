import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getErrorMessage } from "@/lib/error-utils";
import type { DailyAnalytics, CategoryAnalytics } from "@/lib/dailyActionConstants";
import { fetchDailyAnalytics } from "@/services/dailyActionAnalytics";

export type ThemeRankingEntry = [string, CategoryAnalytics];

export function useDailyAnalytics() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<DailyAnalytics | null>(null);

  const loadAnalytics = useCallback(async () => {
    if (!user) return;
    try {
      const result = await fetchDailyAnalytics(user.id);
      setAnalytics(result);
    } catch (error: unknown) {
      console.error("Failed to fetch analytics:", getErrorMessage(error));
    }
  }, [user]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Theme ranking: sorted by avg completion time (fastest first)
  const themeRanking: ThemeRankingEntry[] = analytics
    ? Object.entries(analytics.category_stats)
        .filter(([, s]) => s.avg_completion_minutes !== null)
        .sort(
          (a, b) =>
            (a[1].avg_completion_minutes ?? 999) -
            (b[1].avg_completion_minutes ?? 999)
        )
    : [];

  return {
    analytics,
    themeRanking,
  };
}
