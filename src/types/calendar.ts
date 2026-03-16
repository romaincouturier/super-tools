export interface CalendarEntry {
  id: string;
  type: "formation" | "event" | "live";
  title: string;
  date: string;
  endDate?: string | null;
  location?: string | null;
  time?: string | null;
  path: string;
}
