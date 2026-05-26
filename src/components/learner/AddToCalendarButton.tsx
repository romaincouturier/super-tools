import { CalendarPlus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  title: string;
  /** ISO datetime string */
  startAt: string;
  /** Duration in minutes (defaults to 60) */
  durationMinutes?: number;
  description?: string;
  location?: string;
  url?: string;
  /** Inline style overrides for the trigger button */
  className?: string;
  style?: React.CSSProperties;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function toIcsDate(d: Date) {
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

function toGoogleDate(d: Date) {
  return toIcsDate(d);
}

export default function AddToCalendarButton({
  title,
  startAt,
  durationMinutes = 60,
  description = "",
  location = "",
  url,
  className,
  style,
}: Props) {
  const start = new Date(startAt);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const fullDescription = [description, url].filter(Boolean).join("\n\n");

  const downloadIcs = () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//SuperTilt//Event//FR",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${Date.now()}@supertilt`,
      `DTSTAMP:${toIcsDate(new Date())}`,
      `DTSTART:${toIcsDate(start)}`,
      `DTEND:${toIcsDate(end)}`,
      `SUMMARY:${title}`,
      location ? `LOCATION:${location}` : "",
      `DESCRIPTION:${fullDescription.replace(/\n/g, "\\n")}`,
      url ? `URL:${url}` : "",
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .filter(Boolean)
      .join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${title.replace(/\s+/g, "-").toLowerCase()}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const openGoogle = () => {
    const u = new URL("https://www.google.com/calendar/render");
    u.searchParams.set("action", "TEMPLATE");
    u.searchParams.set("text", title);
    u.searchParams.set("dates", `${toGoogleDate(start)}/${toGoogleDate(end)}`);
    u.searchParams.set("details", fullDescription);
    if (location) u.searchParams.set("location", location);
    window.open(u.toString(), "_blank", "noopener,noreferrer");
  };

  const openOutlook = () => {
    const u = new URL("https://outlook.live.com/calendar/0/deeplink/compose");
    u.searchParams.set("subject", title);
    u.searchParams.set("body", fullDescription);
    if (location) u.searchParams.set("location", location);
    u.searchParams.set("startdt", start.toISOString());
    u.searchParams.set("enddt", end.toISOString());
    window.open(u.toString(), "_blank", "noopener,noreferrer");
  };

  const openYahoo = () => {
    const u = new URL("https://calendar.yahoo.com/");
    u.searchParams.set("v", "60");
    u.searchParams.set("title", title);
    u.searchParams.set("st", toIcsDate(start));
    u.searchParams.set("et", toIcsDate(end));
    u.searchParams.set("desc", fullDescription);
    if (location) u.searchParams.set("in_loc", location);
    window.open(u.toString(), "_blank", "noopener,noreferrer");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={
            className ??
            "flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full transition-all hover:-translate-y-px"
          }
          style={style}
        >
          <CalendarPlus size={14} />
          Ajouter au calendrier
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={openGoogle}>Google Calendar</DropdownMenuItem>
        <DropdownMenuItem onClick={openOutlook}>Outlook</DropdownMenuItem>
        <DropdownMenuItem onClick={openYahoo}>Yahoo Calendar</DropdownMenuItem>
        <DropdownMenuItem onClick={downloadIcs}>Apple Calendar (.ics)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
