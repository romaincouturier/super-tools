import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getErrorMessage } from "@/lib/error-utils";
import type { DailyAction } from "@/lib/dailyActionConstants";
import {
  fetchDailyActions,
  toggleDailyAction,
  checkDailyActionsCompletion,
  decideDailyWatchSource,
} from "@/services/dailyActionAnalytics";

export function useDailyActions() {
  const { user } = useAuth();
  const [actions, setActions] = useState<DailyAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [decisionPending, setDecisionPending] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);

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

  const decideSource = useCallback(async (sourceId: string, status: 'to_subscribe' | 'dropped' | 'followed') => {
    setDecisionPending(true);
    setDecisionError(null);
    try {
      await decideDailyWatchSource(sourceId, status);
      await loadActions();
    } catch (error) {
      setDecisionError(getErrorMessage(error));
    } finally {
      setDecisionPending(false);
    }
  }, [loadActions]);

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
    decideSource,
    decisionPending,
    decisionError,
  };
}
