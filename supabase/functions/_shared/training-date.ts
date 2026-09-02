/**
 * Résolution de la date de session d'une formation.
 *
 * Règle : le planning réel (`training_schedules`) fait foi. À défaut, `start_date`
 * n'est une date de session que si elle couvre une seule journée. Les sessions
 * e-learning / permanentes s'étalent sur une période (start_date != end_date)
 * sans planning : elles n'ont pas de date de session, la variable {{training_date}}
 * doit alors rester vide.
 */

const parseDate = (d?: string | null): Date | null => {
  if (!d) return null;
  const parsed = new Date(d);
  return !isNaN(parsed.getTime()) && parsed.getFullYear() > 2000 ? parsed : null;
};

export interface SessionDate {
  /** Date de début de session (ISO) ou null si la formation n'a pas de date. */
  sessionStart: string | null;
  /** true si la formation couvre une période sans planning (e-learning). */
  isPeriodWithoutSessionDate: boolean;
}

export function resolveSessionDate(
  schedules: Array<{ day_date: string }> | null | undefined,
  startDate?: string | null,
  endDate?: string | null,
): SessionDate {
  if (schedules && schedules.length > 0) {
    return { sessionStart: schedules[0].day_date, isPeriodWithoutSessionDate: false };
  }

  const start = parseDate(startDate);
  const end = parseDate(endDate);

  if (!start) return { sessionStart: null, isPeriodWithoutSessionDate: false };
  if (!end || end.getTime() === start.getTime()) {
    return { sessionStart: startDate ?? null, isPeriodWithoutSessionDate: false };
  }
  return { sessionStart: null, isPeriodWithoutSessionDate: true };
}
