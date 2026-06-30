/** Helpers pour générer des liens "ajouter au calendrier" (sans OAuth). */

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Date au format calendrier (UTC compact) : YYYYMMDDTHHMMSSZ */
export function toCalendarDate(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    "00Z"
  );
}

export interface CalendarEventInput {
  title: string;
  /** ISO datetime string ou Date. */
  startAt: string | Date;
  /** Durée en minutes (défaut 60). */
  durationMinutes?: number;
  details?: string;
  location?: string;
}

/** URL Google Agenda pré-remplie (ouvre l'agenda de l'utilisateur connecté). */
export function buildGoogleCalendarUrl(opts: CalendarEventInput): string {
  const start = new Date(opts.startAt);
  const end = new Date(start.getTime() + (opts.durationMinutes ?? 60) * 60 * 1000);
  const u = new URL("https://www.google.com/calendar/render");
  u.searchParams.set("action", "TEMPLATE");
  u.searchParams.set("text", opts.title);
  u.searchParams.set("dates", `${toCalendarDate(start)}/${toCalendarDate(end)}`);
  if (opts.details) u.searchParams.set("details", opts.details);
  if (opts.location) u.searchParams.set("location", opts.location);
  return u.toString();
}
