import { useState } from "react";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  useCreateMissionActivity,
  useMissionActivities,
} from "@/hooks/useMissions";
import { Mission } from "@/types/missions";
import GoogleCalendarConnect from "@/components/GoogleCalendarConnect";

interface GoogleEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
  attendees: number;
  htmlLink: string | null;
}

interface ImportGoogleEventsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mission: Mission;
}

const ImportGoogleEventsDialog = ({
  open,
  onOpenChange,
  mission,
}: ImportGoogleEventsDialogProps) => {
  const { toast } = useToast();
  const createActivity = useCreateMissionActivity();
  const { data: existingActivities } = useMissionActivities(mission.id);

  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [events, setEvents] = useState<GoogleEvent[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState(
    mission.start_date || format(new Date(), "yyyy-MM-dd")
  );
  const [dateTo, setDateTo] = useState(
    mission.end_date || format(new Date(), "yyyy-MM-dd")
  );

  // Google event IDs already imported for this mission
  const alreadyImportedIds = new Set(
    (existingActivities || [])
      .map((a) => a.google_event_id)
      .filter(Boolean) as string[]
  );

  const fetchEvents = async () => {
    setIsLoading(true);
    setEvents([]);
    setSelectedIds(new Set());

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Non connecté");

      const timeMin = new Date(dateFrom + "T00:00:00").toISOString();
      const timeMax = new Date(dateTo + "T23:59:59").toISOString();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-events?action=events&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      const data = await response.json();

      if (data.error) throw new Error(data.error);

      setEvents(data.events || []);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de récupérer les événements",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleEvent = (eventId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    const importable = events.filter((e) => !alreadyImportedIds.has(e.id));
    if (selectedIds.size === importable.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(importable.map((e) => e.id)));
    }
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) return;

    setIsImporting(true);
    let imported = 0;

    try {
      for (const eventId of selectedIds) {
        const event = events.find((e) => e.id === eventId);
        if (!event) continue;

        const eventDate = event.start.includes("T")
          ? event.start.split("T")[0]
          : event.start;

        await createActivity.mutateAsync({
          mission_id: mission.id,
          description: event.summary,
          activity_date: eventDate,
          duration_type: "hours" as const,
          duration: 0,
          billable_amount: null,
          invoice_url: null,
          invoice_number: null,
          is_billed: false,
          notes: null,
          google_event_id: event.id,
          google_event_link: event.htmlLink || null,
        });
        imported++;
      }

      toast({
        title: `${imported} activité${imported > 1 ? "s" : ""} importée${imported > 1 ? "s" : ""}`,
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const formatEventTime = (event: GoogleEvent) => {
    if (event.allDay) return "Journée entière";
    try {
      const start = parseISO(event.start);
      const end = parseISO(event.end);
      const mins = differenceInMinutes(end, start);
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      const timeStr = `${format(start, "HH:mm")} - ${format(end, "HH:mm")}`;
      const durationStr =
        hours > 0 && remainingMins > 0
          ? `${hours}h${remainingMins}`
          : hours > 0
            ? `${hours}h`
            : `${remainingMins}min`;
      return `${timeStr} (${durationStr})`;
    } catch {
      return "";
    }
  };

  const importableEvents = events.filter(
    (e) => !alreadyImportedIds.has(e.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Importer depuis Google Agenda
          </DialogTitle>
          <DialogDescription>
            Sélectionnez les événements à importer comme activités de la mission.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Connection status */}
          <GoogleCalendarConnect
            onStatusChange={(connected) => setIsConnected(connected)}
          />

          {isConnected && (
            <>
              {/* Date range picker */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Du</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Au</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>

              <Button
                onClick={fetchEvents}
                disabled={isLoading}
                variant="outline"
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Chargement...
                  </>
                ) : (
                  "Rechercher les événements"
                )}
              </Button>

              {/* Events list */}
              {events.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {events.length} événement{events.length > 1 ? "s" : ""} trouvé{events.length > 1 ? "s" : ""}
                      {alreadyImportedIds.size > 0 &&
                        ` (${events.filter((e) => alreadyImportedIds.has(e.id)).length} déjà importé${events.filter((e) => alreadyImportedIds.has(e.id)).length > 1 ? "s" : ""})`}
                    </span>
                    {importableEvents.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleAll}
                        className="text-xs"
                      >
                        {selectedIds.size === importableEvents.length
                          ? "Tout désélectionner"
                          : "Tout sélectionner"}
                      </Button>
                    )}
                  </div>

                  <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
                    {events.map((event) => {
                      const alreadyImported = alreadyImportedIds.has(event.id);
                      return (
                        <label
                          key={event.id}
                          className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                            alreadyImported ? "opacity-50" : ""
                          }`}
                        >
                          <Checkbox
                            checked={
                              alreadyImported || selectedIds.has(event.id)
                            }
                            disabled={alreadyImported}
                            onCheckedChange={() => toggleEvent(event.id)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-sm truncate">
                                {event.summary}
                              </span>
                              {event.htmlLink && (
                                <a
                                  href={event.htmlLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-muted-foreground hover:text-primary shrink-0"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(
                                parseISO(
                                  event.start.includes("T")
                                    ? event.start
                                    : event.start + "T00:00:00"
                                ),
                                "EEEE d MMMM",
                                { locale: fr }
                              )}{" "}
                              — {formatEventTime(event)}
                            </div>
                            {alreadyImported && (
                              <div className="text-xs text-green-600 mt-0.5">
                                Déjà importé
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {!isLoading && events.length === 0 && dateFrom && dateTo && (
                <div className="text-center text-sm text-muted-foreground py-4">
                  Cliquez sur "Rechercher" pour afficher les événements
                </div>
              )}
            </>
          )}
        </div>

        {selectedIds.size > 0 && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Import...
                </>
              ) : (
                `Importer ${selectedIds.size} événement${selectedIds.size > 1 ? "s" : ""}`
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ImportGoogleEventsDialog;
