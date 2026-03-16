import { useNavigate } from "react-router-dom";
import { useUpcomingCalendarEntries } from "@/hooks/useUpcomingCalendarEntries";
import {
  formatEntryDate,
  groupEntriesByDate,
  isEntryToday,
} from "@/lib/calendarFormatters";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Calendar as CalendarIcon,
  GraduationCap,
  CalendarDays,
  MapPin,
  Video,
} from "lucide-react";

const UpcomingCalendarPanel = () => {
  const navigate = useNavigate();
  const { entries, loading } = useUpcomingCalendarEntries();

  if (loading) {
    return (
      <Card className="p-4 flex items-center justify-center h-32">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card className="p-4 text-center">
        <CalendarIcon className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Aucun événement dans les 15 prochains jours ouvrés
        </p>
      </Card>
    );
  }

  const grouped = groupEntriesByDate(entries);

  return (
    <div className="flex flex-col min-h-0 flex-1 gap-3">
      <div className="flex items-center gap-2 shrink-0">
        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Calendrier J+15</h2>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="space-y-2 pr-2">
          {grouped.map(([dateKey, dayEntries]) => (
            <div key={dateKey}>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                {formatEntryDate(dateKey)}
              </p>
              {dayEntries.map((entry) => {
                const entryIsToday = isEntryToday(entry.date);
                return (
                  <button
                    key={`${entry.type}-${entry.id}`}
                    onClick={() => navigate(entry.path)}
                    className="flex items-start gap-2 w-full text-left py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors"
                  >
                    {entry.type === "formation" ? (
                      <GraduationCap className="h-3.5 w-3.5 text-blue-600 mt-0.5 shrink-0" />
                    ) : entry.type === "live" ? (
                      <Video className="h-3.5 w-3.5 text-purple-600 mt-0.5 shrink-0" />
                    ) : (
                      <CalendarDays className="h-3.5 w-3.5 text-teal-600 mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm leading-tight truncate ${entryIsToday ? "font-bold" : ""}`}>
                        {entry.title}
                      </p>
                      {!entryIsToday && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatEntryDate(entry.date, entry.endDate)}
                        </p>
                      )}
                      {entryIsToday && entry.time && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          à {entry.time}
                        </p>
                      )}
                      {entryIsToday && entry.location && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-2.5 w-2.5" />
                          <span className="truncate">{entry.location}</span>
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] shrink-0 ${
                        entry.type === "formation"
                          ? "bg-blue-50 text-blue-700"
                          : entry.type === "live"
                          ? "bg-purple-50 text-purple-700"
                          : "bg-teal-50 text-teal-700"
                      }`}
                    >
                      {entry.type === "formation" ? "Formation" : entry.type === "live" ? "Live" : "Événement"}
                    </Badge>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UpcomingCalendarPanel;
