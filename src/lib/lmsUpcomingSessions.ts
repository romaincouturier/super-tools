const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export interface UpcomingSessionRow {
  session_id: string;
  start_date: string;
  end_date: string | null;
  day_dates: string[] | null;
  city: string | null;
  is_full: boolean;
}

const parse = (d: string) => {
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  return { y, m: m - 1, d: day };
};

/** Ville affichable depuis le nom de ville du lieu ou une adresse libre. */
export function extractCity(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  const postal = s.match(/\b\d{5}\s+([^,—–-]+?)\s*$/);
  if (postal) return postal[1].trim();
  const parts = s.split(/\s*[—–,]\s*|\s+-\s+/).filter(Boolean);
  return (parts[parts.length - 1] || s).trim();
}

function sessionDays(row: Pick<UpcomingSessionRow, "start_date" | "end_date" | "day_dates">): string[] {
  if (row.day_dates && row.day_dates.length > 0) return [...row.day_dates].sort();
  const out: string[] = [];
  const start = new Date(`${row.start_date.slice(0, 10)}T12:00:00Z`);
  const end = new Date(`${(row.end_date || row.start_date).slice(0, 10)}T12:00:00Z`);
  for (let t = start; t <= end && out.length < 31; t = new Date(t.getTime() + 86400000)) {
    out.push(t.toISOString().slice(0, 10));
  }
  return out.length ? out : [row.start_date.slice(0, 10)];
}

const joinFr = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;

/** « 16 et 17 nov. », « 16 au 18 nov. », « 30 nov. au 2 déc. », année ajoutée si différente. */
export function formatSessionDays(
  row: Pick<UpcomingSessionRow, "start_date" | "end_date" | "day_dates">,
  currentYear = new Date().getFullYear(),
): string {
  const days = sessionDays(row).map(parse);
  const last = days[days.length - 1];
  const yearSuffix = last.y !== currentYear ? ` ${last.y}` : "";
  const consecutive = days.every((d, i) => {
    if (i === 0) return true;
    const a = Date.UTC(days[i - 1].y, days[i - 1].m, days[i - 1].d);
    return Date.UTC(d.y, d.m, d.d) - a === 86400000;
  });
  const first = days[0];
  const sameMonth = days.every((d) => d.m === first.m && d.y === first.y);

  if (days.length === 1) return `${first.d} ${MONTHS[first.m]}${yearSuffix}`;
  if (consecutive && days.length > 2) {
    const startLabel = sameMonth
      ? `${first.d}`
      : `${first.d} ${MONTHS[first.m]}${first.y !== last.y ? ` ${first.y}` : ""}`;
    return `${startLabel} au ${last.d} ${MONTHS[last.m]}${yearSuffix}`;
  }
  if (sameMonth) return `${joinFr(days.map((d) => String(d.d)))} ${MONTHS[first.m]}${yearSuffix}`;
  return `${joinFr(days.map((d) => `${d.d} ${MONTHS[d.m]}`))}${yearSuffix}`;
}
