import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { addWorkingDays, fetchWorkingDays } from "@/lib/workingDays";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Calendar as CalendarIcon,
  GraduationCap,
  CalendarDays,
  MapPin,
  ExternalLink,
  Video,
} from "lucide-react";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import { fr } from "date-fns/locale";

interface CalendarEntry {
  id: string;
  type: "formation" | "event" | "live";
  title: string;
  date: string;
  endDate?: string | null;
  location?: string | null;
  time?: string | null;
  path: string;
}

const UpcomingCalendarPanel = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUpcoming = useCallback(async () => {
    if (!user) return;

    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");

    // Get working days config to calculate J+15
    const workingDays = await fetchWorkingDays(supabase);
    const endDate = addWorkingDays(today, 15, workingDays);
    const endDateStr = format(endDate, "yyyy-MM-dd");

    // Fetch formations, events, and live meetings in parallel
    const [trainingsRes, eventsRes, livesRes] = await Promise.all([
      supabase
        .from("trainings")
        .select("id, training_name, start_date, end_date, location")
        .gte("start_date", todayStr)
        .lte("start_date", endDateStr)
        .order("start_date", { ascending: true }),
      (supabase as any)
        .from("events")
        .select("id, title, event_date, location, status")
        .eq("status", "active")
        .gte("event_date", todayStr)
        .lte("event_date", endDateStr)
        .order("event_date", { ascending: true }),
      supabase
        .from("training_live_meetings")
        .select("id, training_id, title, scheduled_at, duration_minutes, status")
        .eq("status", "scheduled")
        .gte("scheduled_at", `${todayStr}T00:00:00`)
        .lte("scheduled_at", `${endDateStr}T23:59:59`)
        .order("scheduled_at", { ascending: true }),
    ]);

    const items: CalendarEntry[] = [];

    if (trainingsRes.data) {
      for (const t of trainingsRes.data) {
        items.push({
          id: t.id,
          type: "formation",
          title: t.training_name,
          date: t.start_date,
          endDate: t.end_date,
          location: t.location,
          path: `/formations/${t.id}`,
        });
      }
    }

    if (eventsRes.data) {
      for (const e of eventsRes.data) {
        items.push({
          id: e.id,
          type: "event",
          title: e.title,
          date: e.event_date,
          location: e.location,
          path: `/events/${e.id}`,
        });
      }
    }

    if (livesRes.data) {
      for (const l of livesRes.data) {
        const dt = parseISO(l.scheduled_at);
        items.push({
          id: l.id,
          type: "live",
          title: l.title,
          date: format(dt, "yyyy-MM-dd"),
          time: format(dt, "HH:mm"),
          path: `/formations/${l.training_id}`,
        });
      }
    }

    // Sort chronologically
    items.sort((a, b) => a.date.localeCompare(b.date));
    setEntries(items);
  }, [user]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchUpcoming();
      setLoading(false);
    };
    load();
  }, [fetchUpcoming]);

  const formatEntryDate = (dateStr: string, endDateStr?: string | null) => {
    const date = parseISO(dateStr);
    if (isToday(date)) {
      return "Aujourd'hui";
    }
    if (isTomorrow(date)) {
      return "Demain";
    }
    const formatted = format(date, "EEE d MMM", { locale: fr });
    if (endDateStr && endDateStr !== dateStr) {
      const endDate = parseISO(endDateStr);
      return `${formatted} → ${format(endDate, "d MMM", { locale: fr })}`;
    }
    return formatted;
  };

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

  // Group entries by date
  const grouped: Record<string, CalendarEntry[]> = {};
  for (const entry of entries) {
    (grouped[entry.date] = grouped[entry.date] || []).push(entry);
  }

  return (
    <div className="flex flex-col min-h-0 flex-1 gap-3">
      <div className="flex items-center gap-2 shrink-0">
        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Calendrier J+15</h2>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="space-y-2 pr-2">
          {Object.entries(grouped).map(([dateKey, dayEntries]) => (
            <div key={dateKey}>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                {formatEntryDate(dateKey)}
              </p>
              {dayEntries.map((entry) => {
                const entryIsToday = isToday(parseISO(entry.date));
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
