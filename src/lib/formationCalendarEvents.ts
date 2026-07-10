/**
 * Génère la liste des évènements Google Calendar à créer pour une formation :
 * - un évènement principal par jour de formation (schedules)
 * - évènement "Installation" 1h avant chaque jour (présentiel)
 * - trajets et train selon la ville détectée dans l'adresse (Paris / Lyon)
 */

export interface CalendarEventInput {
  summary: string;
  description?: string;
  location?: string;
  /** "YYYY-MM-DDTHH:MM:00" (naïf, timezone fournie séparément) */
  startDateTime: string;
  endDateTime: string;
  timeZone: string;
  skipMeet: boolean;
}

export interface FormationScheduleDay {
  day_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM or HH:MM:SS
  end_time: string;
}

export interface BuildFormationEventsInput {
  trainingId: string;
  trainingName: string;
  clientName: string | null;
  location: string;
  schedules: FormationScheduleDay[];
  appUrl: string; // base URL, e.g. window.location.origin
  isPresentiel: boolean;
}

const TZ = "Europe/Paris";

function normalizeTime(t: string): string {
  // "HH:MM:SS" -> "HH:MM"; "HH:MM" -> "HH:MM"
  return t.slice(0, 5);
}

function toDateTime(dayDate: string, time: string): string {
  return `${dayDate}T${normalizeTime(time)}:00`;
}

/** Add minutes to a "HH:MM" time on `dayDate`. Returns local naive datetime. */
function shiftDateTime(dayDate: string, time: string, deltaMinutes: number): string {
  const [h, m] = normalizeTime(time).split(":").map(Number);
  const totalMin = h * 60 + m + deltaMinutes;
  const dayShift = Math.floor(totalMin / (24 * 60));
  const inDayMin = ((totalMin % (24 * 60)) + 24 * 60) % (24 * 60);
  const nh = Math.floor(inDayMin / 60);
  const nm = inDayMin % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  const shiftedDate = new Date(`${dayDate}T00:00:00Z`);
  shiftedDate.setUTCDate(shiftedDate.getUTCDate() + dayShift);
  const y = shiftedDate.getUTCFullYear();
  const mo = pad(shiftedDate.getUTCMonth() + 1);
  const d = pad(shiftedDate.getUTCDate());
  return `${y}-${mo}-${d}T${pad(nh)}:${pad(nm)}:00`;
}

function shiftDay(dayDate: string, deltaDays: number): string {
  const dt = new Date(`${dayDate}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

function detectCity(location: string): "paris" | "lyon" | "other" {
  const l = location.toLowerCase();
  if (l.includes("paris")) return "paris";
  if (l.includes("lyon")) return "lyon";
  return "other";
}

export function buildFormationCalendarEvents(input: BuildFormationEventsInput): CalendarEventInput[] {
  const { trainingId, trainingName, clientName, location, schedules, appUrl, isPresentiel } = input;
  if (schedules.length === 0) return [];

  const sorted = [...schedules].sort((a, b) => a.day_date.localeCompare(b.day_date));
  const mainTitle = clientName ? `${clientName} — ${trainingName}` : trainingName;
  const formationUrl = `${appUrl}/formations/${trainingId}`;
  const description = `Formation : ${trainingName}\n${formationUrl}`;

  const events: CalendarEventInput[] = [];

  // Main formation events
  for (const s of sorted) {
    events.push({
      summary: mainTitle,
      description,
      location,
      startDateTime: toDateTime(s.day_date, s.start_time),
      endDateTime: toDateTime(s.day_date, s.end_time),
      timeZone: TZ,
      skipMeet: isPresentiel,
    });
  }

  if (!isPresentiel) return events;

  // Installation 1h before each day
  for (const s of sorted) {
    events.push({
      summary: `Installation — ${mainTitle}`,
      description,
      location,
      startDateTime: shiftDateTime(s.day_date, s.start_time, -60),
      endDateTime: toDateTime(s.day_date, s.start_time),
      timeZone: TZ,
      skipMeet: true,
    });
  }

  const city = detectCity(location);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  if (city === "paris") {
    // Veille du 1er jour : trajet 18h-19h puis train 19h-21h
    const veille = shiftDay(first.day_date, -1);
    events.push({
      summary: `Trajet — ${mainTitle}`,
      description,
      startDateTime: `${veille}T18:00:00`,
      endDateTime: `${veille}T19:00:00`,
      timeZone: TZ,
      skipMeet: true,
    });
    events.push({
      summary: `Train — ${mainTitle}`,
      description,
      startDateTime: `${veille}T19:00:00`,
      endDateTime: `${veille}T21:00:00`,
      timeZone: TZ,
      skipMeet: true,
    });
    // Dernier jour : train 18h-20h puis trajet 20h-20h45
    events.push({
      summary: `Train — ${mainTitle}`,
      description,
      startDateTime: `${last.day_date}T18:00:00`,
      endDateTime: `${last.day_date}T20:00:00`,
      timeZone: TZ,
      skipMeet: true,
    });
    events.push({
      summary: `Trajet — ${mainTitle}`,
      description,
      startDateTime: `${last.day_date}T20:00:00`,
      endDateTime: `${last.day_date}T20:45:00`,
      timeZone: TZ,
      skipMeet: true,
    });
  } else if (city === "lyon") {
    // Chaque jour : trajet 1h démarrant 2h avant le début ; trajet 1h démarrant 30min après la fin
    for (const s of sorted) {
      events.push({
        summary: `Trajet — ${mainTitle}`,
        description,
        startDateTime: shiftDateTime(s.day_date, s.start_time, -120),
        endDateTime: shiftDateTime(s.day_date, s.start_time, -60),
        timeZone: TZ,
        skipMeet: true,
      });
      events.push({
        summary: `Trajet — ${mainTitle}`,
        description,
        startDateTime: shiftDateTime(s.day_date, s.end_time, 30),
        endDateTime: shiftDateTime(s.day_date, s.end_time, 90),
        timeZone: TZ,
        skipMeet: true,
      });
    }
  }

  return events;
}
