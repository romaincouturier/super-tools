/**
 * Pure formatting functions for training data display.
 *
 * Extracted from FormationDetail.tsx for testability and reuse.
 */
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

// ── Types ────────────────────────────────────────────────────────────────────

interface ScheduleTime {
  start_time: string;
  end_time: string;
}

interface ScheduleWithDate extends ScheduleTime {
  day_date: string;
}

// ── Duration ─────────────────────────────────────────────────────────────────

/**
 * Calculate total training duration in hours.
 * Sessions <= 4h count as 3.5h, sessions > 4h count as 7h.
 */
export function calculateTotalDuration(schedules: ScheduleTime[]): number {
  return schedules.reduce((total, schedule) => {
    const [startH, startM] = schedule.start_time.split(":").map(Number);
    const [endH, endM] = schedule.end_time.split(":").map(Number);
    const durationInHours = (endH * 60 + endM - (startH * 60 + startM)) / 60;
    return total + (durationInHours <= 4 ? 3.5 : 7);
  }, 0);
}

// ── Labels ───────────────────────────────────────────────────────────────────

const FORMAT_LABELS: Record<string, string> = {
  intra: "Intra-entreprise",
  "inter-entreprises": "Inter-entreprises",
  e_learning: "E-learning",
};

/** Human-readable label for a training format value. */
export function getFormatLabel(formatValue: string | null | undefined): string | null {
  if (!formatValue) return null;
  return FORMAT_LABELS[formatValue] ?? null;
}

/** Build a sponsor display name from first/last name parts. */
export function getSponsorName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string | null {
  if (firstName && lastName) return `${firstName} ${lastName}`;
  if (firstName) return firstName;
  if (lastName) return lastName;
  return null;
}

// ── Date formatting ──────────────────────────────────────────────────────────

/**
 * Format training date range with schedule details.
 *
 * Handles:
 * - Single day with time
 * - Contiguous date range with common time
 * - Non-contiguous days with day count
 * - Variable schedules across days
 * - Fallback to start/end dates without schedules
 */
export function formatDateWithSchedule(
  startDate: string,
  endDate: string | null,
  schedules: ScheduleWithDate[],
): string {
  if (schedules.length > 0) {
    const first = schedules[0];
    const last = schedules[schedules.length - 1];
    const firstDate = parseISO(first.day_date);
    const lastDate = parseISO(last.day_date);

    // Time info suffix
    const allSameTimes = schedules.every(
      (s) => s.start_time === first.start_time && s.end_time === first.end_time,
    );
    const timeInfo = allSameTimes
      ? ` • ${first.start_time.slice(0, 5)} - ${first.end_time.slice(0, 5)}`
      : " • horaires variables";

    if (schedules.length === 1) {
      return format(firstDate, "EEEE d MMMM yyyy", { locale: fr }) + timeInfo;
    }

    // Contiguous check
    const isContiguous = schedules.every((schedule, i) => {
      if (i === 0) return true;
      const prev = parseISO(schedules[i - 1].day_date);
      const curr = parseISO(schedule.day_date);
      return Math.round((curr.getTime() - prev.getTime()) / 86_400_000) === 1;
    });

    if (isContiguous) {
      return `Du ${format(firstDate, "EEEE d MMMM", { locale: fr })} au ${format(lastDate, "EEEE d MMMM yyyy", { locale: fr })}${timeInfo}`;
    }

    return `${schedules.length} jours • ${format(firstDate, "d MMM", { locale: fr })} au ${format(lastDate, "d MMM yyyy", { locale: fr })}${timeInfo}`;
  }

  // Fallback without schedules
  const start = parseISO(startDate);
  if (!endDate) {
    return format(start, "EEEE d MMMM yyyy", { locale: fr });
  }
  const end = parseISO(endDate);
  return `Du ${format(start, "EEEE d MMMM", { locale: fr })} au ${format(end, "EEEE d MMMM yyyy", { locale: fr })}`;
}
