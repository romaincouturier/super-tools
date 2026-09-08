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

const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
  d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", ...opts });

/**
 * Libellé de date à injecter dans {{training_date}}.
 *
 * Ne renvoie jamais une chaîne vide quand la formation a des dates : une
 * période sans planning devient "1er au 5 octobre 2026" au lieu d'un blanc
 * qui laisserait "prévue le" ou "Date :" sans valeur dans les emails.
 */
export function formatSessionDateFr(
  schedules: Array<{ day_date: string }> | null | undefined,
  startDate?: string | null,
  endDate?: string | null,
): string {
  const { sessionStart } = resolveSessionDate(schedules, startDate, endDate);
  if (sessionStart) {
    return fmt(new Date(sessionStart), {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start) return "";
  if (!end) return fmt(start, { day: "numeric", month: "long", year: "numeric" });

  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startLabel = sameMonth
    ? fmt(start, { day: "numeric" })
    : fmt(start, { day: "numeric", month: "long" });
  const endLabel = fmt(end, { day: "numeric", month: "long", year: "numeric" });
  return `${startLabel} au ${endLabel}`;
}

/**
 * Formations permanentes / e-learning sans dates : aucune date ne doit
 * apparaître dans les emails. Retire les propositions du type
 * « qui se déroulera du {{start_date}} au {{end_date}} » ainsi que les
 * placeholders résiduels, plutôt que d'écrire « date inconnue ».
 */
export function stripDatePlaceholders(html: string): string {
  return html
    // Phrase autonome entièrement consacrée aux dates
    .replace(
      /(>)\s*[^.<]*\{\{start_date\}\}[\s\S]{0,80}?\{\{end_date\}\}(?:\s*<\/strong>)?[^.<]*\.\s*/gi,
      "$1",
    )
    // Clause relative ou verbale introduisant la période
    .replace(
      /\s*(?:,\s*)?(?:qui\s+)?(?:se\s+déroulera|se\s+déroule|aura\s+lieu|est\s+accessible)[\s\S]{0,80}?\{\{start_date\}\}[\s\S]{0,80}?\{\{end_date\}\}(?:\s*<\/strong>)?/gi,
      "",
    )
    // Phrase entière restée orpheline (« La formation est accessible du … au …. »)
    .replace(/[^.<>]*\{\{start_date\}\}[\s\S]{0,120}?\{\{end_date\}\}[\s\S]{0,20}?\./gi, "")
    // Derniers placeholders et résidus « du  au  »
    .replace(/\{\{(?:start|end)_date\}\}/gi, "")
    .replace(/\s*du\s*(?:<strong>\s*<\/strong>)?\s*au\s*(?:<strong>\s*<\/strong>)?\s*(?=[.<])/gi, "")
    .replace(/<strong>\s*<\/strong>/gi, "")
    .replace(/\s+([.,])/g, "$1")
    // Paragraphes vidés par les suppressions
    .replace(/<p[^>]*>\s*<\/p>/gi, "");
}
