/**
 * Shared French date formatting utilities.
 *
 * Centralises date-fns + fr locale patterns that were duplicated
 * across 15+ components and pages.
 */
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

// ── Core formatters ─────────────────────────────────────────────────────────

/** `dd/MM/yyyy` – e.g. "15/03/2026" */
export function formatDateFr(dateStr: string): string {
  return format(parseISO(dateStr), "dd/MM/yyyy", { locale: fr });
}

/** `d MMMM yyyy` – e.g. "15 mars 2026" */
export function formatDateLong(dateStr: string): string {
  return format(parseISO(dateStr), "d MMMM yyyy", { locale: fr });
}

/** `EEEE d MMMM yyyy` – e.g. "dimanche 15 mars 2026" */
export function formatDateWithDayOfWeek(dateStr: string): string {
  return format(parseISO(dateStr), "EEEE d MMMM yyyy", { locale: fr });
}

/** `d MMM yyyy` – e.g. "15 mars 2026" (short month) */
export function formatDateShort(dateStr: string): string {
  return format(parseISO(dateStr), "d MMM yyyy", { locale: fr });
}

/** `dd/MM` – e.g. "15/03" (for attendance columns) */
export function formatDateSlot(dateStr: string): string {
  return format(parseISO(dateStr), "dd/MM", { locale: fr });
}

// ── With time ───────────────────────────────────────────────────────────────

/** `d MMMM yyyy 'à' HH:mm` – e.g. "15 mars 2026 à 14:30" */
export function formatDateWithTime(dateStr: string): string {
  return format(new Date(dateStr), "d MMMM yyyy 'à' HH:mm", { locale: fr });
}

/** `d MMMM yyyy 'à' HH:mm:ss` – e.g. "15 mars 2026 à 14:30:45" */
export function formatDateTimeSeconds(dateStr: string): string {
  return format(parseISO(dateStr), "d MMMM yyyy 'à' HH:mm:ss", { locale: fr });
}

/** `d MMM 'à' HH:mm` – e.g. "15 mars à 14:30" (compact sent-at) */
export function formatSentDateTime(dateStr: string): string {
  return format(parseISO(dateStr), "d MMM 'à' HH:mm", { locale: fr });
}

/** `d MMM yyyy HH:mm` – e.g. "15 mars 2026 14:30" (log timestamps) */
export function formatDateTimeShort(dateStr: string): string {
  return format(new Date(dateStr), "d MMM yyyy HH:mm", { locale: fr });
}

// ── Labels ──────────────────────────────────────────────────────────────────

/** "Matin" / "Après-midi" for AM/PM periods. */
export function getPeriodLabel(period: "AM" | "PM" | string): string {
  return period === "AM" ? "Matin" : "Après-midi";
}

// ── Date ranges ─────────────────────────────────────────────────────────────

/**
 * Smart date range: same month → "1 - 15 mars 2026",
 * different months → "1 mars - 15 avr. 2026",
 * single date → "15 mars 2026".
 */
export function formatDateRange(
  startDate: string,
  endDate: string | null,
): string {
  const start = parseISO(startDate);
  if (!endDate) {
    return format(start, "d MMMM yyyy", { locale: fr });
  }
  const end = parseISO(endDate);
  if (
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear()
  ) {
    return `${format(start, "d", { locale: fr })} - ${format(end, "d MMMM yyyy", { locale: fr })}`;
  }
  return `${format(start, "d MMM", { locale: fr })} - ${format(end, "d MMM yyyy", { locale: fr })}`;
}

/**
 * Training dates with "du…au" / "le" prefix.
 * - Single date → "le 15 mars 2026"
 * - Range → "du 15 mars 2026 au 17 mars 2026"
 */
export function formatTrainingDates(
  startDate: string,
  endDate: string | null,
): string {
  const start = format(new Date(startDate), "d MMMM yyyy", { locale: fr });
  if (endDate && endDate !== startDate) {
    const end = format(new Date(endDate), "d MMMM yyyy", { locale: fr });
    return `du ${start} au ${end}`;
  }
  return `le ${start}`;
}
