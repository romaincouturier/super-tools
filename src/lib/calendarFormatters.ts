import { format, parseISO, isToday, isTomorrow } from "date-fns";
import { fr } from "date-fns/locale";
import type { CalendarEntry } from "@/types/calendar";

/**
 * Format a calendar entry date for display.
 * Returns "Aujourd'hui", "Demain", or a relative formatted date like "lun. 3 mars".
 * If endDate differs from date, appends an arrow range: "lun. 3 mars -> 5 mars".
 */
export function formatEntryDate(
  dateStr: string,
  endDateStr?: string | null
): string {
  const date = parseISO(dateStr);
  if (isToday(date)) {
    return "Aujourd'hui";
  }
  if (isTomorrow(date)) {
    return "Demain";
  }
  const formatted = format(date, "EEE d MMM", { locale: fr });
  if (endDateStr && endDateStr !== dateStr) {
    const endDate = parseISO(endDateStr);
    return `${formatted} \u2192 ${format(endDate, "d MMM", { locale: fr })}`;
  }
  return formatted;
}

/**
 * Group calendar entries by date string.
 * Returns an ordered array of [dateKey, entries[]] tuples preserving chronological order.
 */
export function groupEntriesByDate(
  entries: CalendarEntry[]
): [string, CalendarEntry[]][] {
  const grouped: Record<string, CalendarEntry[]> = {};
  for (const entry of entries) {
    (grouped[entry.date] = grouped[entry.date] || []).push(entry);
  }
  return Object.entries(grouped);
}

/**
 * Check if a date string corresponds to today.
 */
export function isEntryToday(dateStr: string): boolean {
  return isToday(parseISO(dateStr));
}
