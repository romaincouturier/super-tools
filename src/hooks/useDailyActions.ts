import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getErrorMessage } from "@/lib/error-utils";
import type { DailyAction } from "@/lib/dailyActionConstants";
import {
  fetchDailyActions,
  toggleDailyAction,
  checkDailyActionsCompletion,
} from "@/services/dailyActionAnalytics";

export function useDailyActions() {
  const { user } = useAuth();
  const [actions, setActions] = useState<DailyAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const loadActions = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchDailyActions(user.id, today);
      setActions(data);
    } catch (error: unknown) {
      console.error("Failed to fetch daily actions:", getErrorMessage(error));
    }
  }, [user, today]);

  const toggleAction = useCallback(
    async (actionId: string, completed: boolean) => {
      // Optimistic update
      setActions((prev) =>
        prev.map((a) =>
          a.id === actionId
            ? {
                ...a,
                is_completed: completed,
                completed_at: completed ? new Date().toISOString() : null,
                auto_completed: false,
              }
            : a
        )
      );

      try {
        await toggleDailyAction(actionId, completed);
      } catch (error: unknown) {
        console.error("Failed to toggle action:", getErrorMessage(error));
        // Revert on error
        await loadActions();
      }
    },
    [loadActions]
  );

  const autoDetect = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      await checkDailyActionsCompletion();
      await loadActions();
    } catch (error: unknown) {
      console.error("Failed to auto-detect:", getErrorMessage(error));
    } finally {
      setRefreshing(false);
    }
  }, [user, loadActions]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await loadActions();
      setLoading(false);
      // Auto-detect on first load
      autoDetect();
    };
    load();
  }, [loadActions, autoDetect]);

  // Derived values
  const totalCount = actions.length;
  const completedCount = actions.filter((a) => a.is_completed).length;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return {
    actions,
    loading,
    refreshing,
    totalCount,
    completedCount,
    progressPercent,
    toggleAction,
    autoDetect,
  };
}
