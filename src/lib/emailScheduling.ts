import { differenceInDays, parseISO } from "date-fns";

export interface EmailMode {
  status: string;
  sendWelcomeNow: boolean;
}

/**
 * Determine email scheduling mode based on how far the training start date is.
 *
 * - No start date             → "programme", don't send now (will be scheduled later)
 * - Already started (≤ 0 days)→ "non_envoye", don't send
 * - < 2 days away             → "manuel", don't send (too close, handle manually)
 * - 2–7 days away             → "accueil_envoye", send welcome now
 * - > 7 days away             → "programme", don't send now (will be scheduled)
 */
export function getEmailMode(startDateStr: string | null | undefined): EmailMode {
  if (!startDateStr) {
    return { status: "programme", sendWelcomeNow: false };
  }

  const startDate = parseISO(startDateStr);
  const today = new Date();
  const daysUntilStart = differenceInDays(startDate, today);

  if (daysUntilStart <= 0) {
    return { status: "non_envoye", sendWelcomeNow: false };
  }

  if (daysUntilStart < 2) {
    return { status: "manuel", sendWelcomeNow: false };
  }

  if (daysUntilStart <= 7) {
    return { status: "accueil_envoye", sendWelcomeNow: true };
  }

  return { status: "programme", sendWelcomeNow: false };
}

/** Check if the email mode requires manual handling by the user. */
export function isManualEmailMode(startDateStr: string | null | undefined): boolean {
  const { status } = getEmailMode(startDateStr);
  return status === "manuel" || status === "non_envoye";
}

/**
 * A training is "ongoing" when today is between start_date and end_date (inclusive).
 * Used to override welcome-email skip-logic when a participant is added mid-session:
 * even though the training has "already started" (getEmailMode returns "non_envoye"),
 * they still need logistics / classe virtuelle link / convocation.
 *
 * Returns false when either date is missing or invalid.
 */
export function isTrainingOngoing(
  startDateStr: string | null | undefined,
  endDateStr: string | null | undefined,
): boolean {
  if (!startDateStr || !endDateStr) return false;
  const start = parseISO(startDateStr);
  const end = parseISO(endDateStr);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  const today = new Date();
  return differenceInDays(today, start) >= 0 && differenceInDays(end, today) >= 0;
}
