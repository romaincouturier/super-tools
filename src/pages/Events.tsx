import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO, isPast, endOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { formatDateWithDayOfWeek } from "@/lib/dateFormatters";
import { Loader2, Plus, CalendarDays, ArrowLeft, MapPin, Video, Search, X, Ban, Globe } from "lucide-react";
import { getCfpDaysLeft } from "@/types/events";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useEvents } from "@/hooks/useEvents";

const Events = () => {
  const navigate = useNavigate();
  const { data: events = [], isLoading } = useEvents();
  const [filter, setFilter] = useState<"upcoming" | "past">("upcoming");
  const [searchQuery, setSearchQuery] = useState("");

  const matchesSearch = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return () => true;
    return (e: (typeof events)[0]) => {
      return (
        e.title.toLowerCase().includes(q) ||
        (e.location || "").toLowerCase().includes(q) ||
        (e.description || "").toLowerCase().includes(q)
      );
    };
  }, [searchQuery]);

  const upcomingEvents = useMemo(
    () =>
      events
        .filter((e) => !isPast(endOfDay(parseISO(e.event_date))) && matchesSearch(e))
        .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()),
    [events, matchesSearch]
  );

  const pastEvents = useMemo(
    () =>
      events
        .filter((e) => isPast(endOfDay(parseISO(e.event_date))) && matchesSearch(e))
        .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()),
    [events, matchesSearch]
  );

  const displayedEvents = filter === "upcoming" ? upcomingEvents : pastEvents;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 hidden sm:block">
                <CalendarDays className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold">Événements</h1>
            </div>
          </div>
          <Button size="sm" onClick={() => navigate("/events/new")}>
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Nouvel événement</span>
          </Button>
        </div>

        {/* Tabs + Search */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <Tabs value={filter} onValueChange={(v) => setFilter(v as "upcoming" | "past")}>
                <TabsList>
                  <TabsTrigger value="upcoming">
                    À venir ({upcomingEvents.length})
                  </TabsTrigger>
                  <TabsTrigger value="past">
                    Passés ({pastEvents.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un événement…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-8 w-full sm:w-[280px]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {displayedEvents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {searchQuery ? (
                  <>
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">
                      Aucun événement ne correspond à « {searchQuery} »
                    </p>
                  </>
                ) : filter === "upcoming" ? (
                  <>
                    <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">Aucun événement à venir</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => navigate("/events/new")}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Créer votre premier événement
                    </Button>
                  </>
                ) : (
                  <>
                    <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">Aucun événement passé</p>
                  </>
                )}
              </div>
            ) : (
              <div className="grid gap-3">
                {displayedEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/events/${event.id}`)}
                  >
                    {/* Date block */}
                    <div className="flex-shrink-0 w-14 h-14 rounded-lg bg-primary/10 flex flex-col items-center justify-center">
                      <span className="text-xs font-medium text-primary uppercase">
                        {format(parseISO(event.event_date), "MMM", { locale: fr })}
                      </span>
                      <span className="text-lg font-bold text-primary leading-tight">
                        {format(parseISO(event.event_date), "d")}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium truncate ${event.status === "cancelled" ? "line-through text-muted-foreground" : ""}`}>
                          {event.title}
                        </p>
                        {event.event_type === "external" && (
                          <Badge variant="outline" className="flex-shrink-0 gap-1 text-xs text-blue-600 border-blue-300">
                            <Globe className="h-3 w-3" />
                            Externe
                          </Badge>
                        )}
                        {event.status === "cancelled" && (
                          <Badge variant="destructive" className="flex-shrink-0 gap-1 text-xs">
                            <Ban className="h-3 w-3" />
                            Annulé
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span>
                          {formatDateWithDayOfWeek(event.event_date)}
                          {event.event_time && ` à ${event.event_time.slice(0, 5)}`}
                        </span>
                        {event.event_type === "external" && event.cfp_deadline && (() => {
                          const daysLeft = getCfpDaysLeft(event.cfp_deadline);
                          if (daysLeft < 0) return null;
                          return (
                            <span className={`text-xs ${daysLeft <= 7 ? "text-orange-600 font-medium" : ""}`}>
                              CFP : {daysLeft === 0 ? "aujourd'hui" : daysLeft === 1 ? "demain" : `J-${daysLeft}`}
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Location badge */}
                    {event.location && (
                      <Badge variant="outline" className="flex-shrink-0 gap-1">
                        {event.location_type === "visio" ? (
                          <Video className="h-3 w-3" />
                        ) : (
                          <MapPin className="h-3 w-3" />
                        )}
                        <span className="max-w-[200px] truncate">{event.location}</span>
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Events;
