import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { addWorkingDays, fetchWorkingDays } from "@/lib/workingDays";
import { getErrorMessage } from "@/lib/error-utils";
import {
  fetchUpcomingTrainings,
  fetchUpcomingEvents,
  fetchUpcomingLiveMeetings,
  unifyCalendarEntries,
} from "@/services/calendarEntries";
import type { CalendarEntry } from "@/types/calendar";

interface UseUpcomingCalendarEntriesResult {
  entries: CalendarEntry[];
  loading: boolean;
  error: string | null;
}

export function useUpcomingCalendarEntries(): UseUpcomingCalendarEntriesResult {
  const { user } = useAuth();
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUpcoming = useCallback(async () => {
    if (!user) return;

    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");

    // Get working days config to calculate J+15
    const workingDays = await fetchWorkingDays(supabase);
    const endDate = addWorkingDays(today, 15, workingDays);
    const endDateStr = format(endDate, "yyyy-MM-dd");

    // Fetch formations, events, and live meetings in parallel
    const [trainings, events, lives] = await Promise.all([
      fetchUpcomingTrainings(todayStr, endDateStr),
      fetchUpcomingEvents(todayStr, endDateStr),
      fetchUpcomingLiveMeetings(todayStr, endDateStr),
    ]);

    const items = unifyCalendarEntries(trainings, events, lives);
    setEntries(items);
  }, [user]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        await fetchUpcoming();
      } catch (error: unknown) {
        setError(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [fetchUpcoming]);

  return { entries, loading, error };
}
