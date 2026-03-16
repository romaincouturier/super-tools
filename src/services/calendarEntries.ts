/**
 * Calendar entries service — centralizes Supabase DB calls for the upcoming calendar panel.
 * Fetches trainings, events, and live meetings, then unifies them into CalendarEntry[].
 */
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import type { CalendarEntry } from "@/types/calendar";


interface TrainingRow {
  id: string;
  training_name: string;
  start_date: string;
  end_date: string | null;
  location: string | null;
}

interface EventRow {
  id: string;
  title: string;
  event_date: string;
  location: string | null;
  status: string;
}

interface LiveMeetingRow {
  id: string;
  training_id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
}

function throwIfError<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data;
}

/** Fetch upcoming trainings within a date range */
export async function fetchUpcomingTrainings(
  fromDate: string,
  toDate: string
): Promise<TrainingRow[]> {
  const result = await (supabase as unknown as { from: (table: string) => ReturnType<typeof supabase.from> })
    .from("trainings")
    .select("id, training_name, start_date, end_date, location")
    .or("is_cancelled.is.null,is_cancelled.eq.false")
    .gte("start_date", fromDate)
    .lte("start_date", toDate)
    .order("start_date", { ascending: true });
  return (throwIfError(result) || []) as TrainingRow[];
}

/** Fetch upcoming active events within a date range */
export async function fetchUpcomingEvents(
  fromDate: string,
  toDate: string
): Promise<EventRow[]> {
  const result = await (supabase as unknown as { from: (table: string) => ReturnType<typeof supabase.from> })
    .from("events")
    .select("id, title, event_date, location, status")
    .eq("status", "active")
    .gte("event_date", fromDate)
    .lte("event_date", toDate)
    .order("event_date", { ascending: true });
  return (throwIfError(result) || []) as EventRow[];
}

/** Fetch upcoming scheduled live meetings within a date range */
export async function fetchUpcomingLiveMeetings(
  fromDate: string,
  toDate: string
): Promise<LiveMeetingRow[]> {
  const result = await (supabase as unknown as { from: (table: string) => ReturnType<typeof supabase.from> })
    .from("training_live_meetings")
    .select("id, training_id, title, scheduled_at, duration_minutes, status")
    .eq("status", "scheduled")
    .gte("scheduled_at", `${fromDate}T00:00:00`)
    .lte("scheduled_at", `${toDate}T23:59:59`)
    .order("scheduled_at", { ascending: true });
  return (throwIfError(result) || []) as LiveMeetingRow[];
}

/** Unify trainings, events, and live meetings into a sorted CalendarEntry array */
export function unifyCalendarEntries(
  trainings: TrainingRow[],
  events: EventRow[],
  lives: LiveMeetingRow[]
): CalendarEntry[] {
  const items: CalendarEntry[] = [];

  for (const t of trainings) {
    items.push({
      id: t.id,
      type: "formation",
      title: t.training_name,
      date: t.start_date,
      endDate: t.end_date,
      location: t.location,
      path: `/formations/${t.id}`,
    });
  }

  for (const e of events) {
    items.push({
      id: e.id,
      type: "event",
      title: e.title,
      date: e.event_date,
      location: e.location,
      path: `/events/${e.id}`,
    });
  }

  for (const l of lives) {
    const dt = parseISO(l.scheduled_at);
    items.push({
      id: l.id,
      type: "live",
      title: l.title,
      date: format(dt, "yyyy-MM-dd"),
      time: format(dt, "HH:mm"),
      path: `/formations/${l.training_id}`,
    });
  }

  // Sort chronologically
  items.sort((a, b) => a.date.localeCompare(b.date));
  return items;
}
