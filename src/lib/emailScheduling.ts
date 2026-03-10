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
