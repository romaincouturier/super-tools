import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarPlus, ExternalLink, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { todayAsISO } from "@/lib/dateFormatters";

export type Formality = "tu" | "vous";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  opportunityTitle: string;
  company: string;
  contactEmail: string;
  /** When provided, overrides the auto-generated buildTitle() computation. */
  initialSummary?: string;
  /** When provided, overrides the auto-generated tu/vous description template. */
  initialDescription?: string;
  /** Default tu/vous variant. CRM => "vous", missions => "tu". */
  defaultFormality?: Formality;
  /** Called when the event is successfully created, with the event date (YYYY-MM-DD) and summary. */
  onEventCreated?: (eventDate: string, eventSummary: string) => void;
}

const DESCRIPTION_VOUS = `Bonjour,

Je me permets de vous envoyer cette invitation pour notre échange à venir.

Au programme :
- Présentation de SuperTilt et de nos activités
- Écoute et compréhension de vos besoins
- Questions / réponses
- Définition des prochaines étapes

N'hésitez pas à me contacter si vous avez la moindre question en amont.

Au plaisir d'échanger avec vous,`;

const DESCRIPTION_TU = `Bonjour,

Je te confirme notre échange à venir.

Au programme :
- Point sur l'avancée du projet
- Échange sur tes besoins et questions
- Définition des prochaines étapes

N'hésite pas à me contacter si tu as la moindre question en amont.

Au plaisir d'échanger,`;

function descriptionFor(formality: Formality): string {
  return formality === "tu" ? DESCRIPTION_TU : DESCRIPTION_VOUS;
}

function buildTitle(company: string, title: string): string {
  const c = company?.trim();
  const t = title?.trim();
  if (c && t) return `${c} x SuperTilt, Échange ${t}`;
  if (c) return `${c} x SuperTilt`;
  if (t) return `SuperTilt, Échange ${t}`;
  return "Échange";
}

function toIso(dateLocal: string, timeLocal: string): string {
  const dt = new Date(`${dateLocal}T${timeLocal}`);
  return dt.toISOString();
}

export default function CreateCalendarEventDialog({ open, onOpenChange, opportunityTitle, company, contactEmail, initialSummary, initialDescription, defaultFormality = "vous", onEventCreated }: Props) {
  const today = todayAsISO();
  const [summary, setSummary] = useState(() => initialSummary ?? buildTitle(company, opportunityTitle));
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("10:30");
  const [attendeeEmail, setAttendeeEmail] = useState(contactEmail);
  const [formality, setFormality] = useState<Formality>(defaultFormality);
  const [description, setDescription] = useState(initialDescription ?? descriptionFor(defaultFormality));
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ htmlLink: string; meetLink: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const descriptionDirtyRef = useRef(false);

  useEffect(() => {
    if (open) {
      setSummary(initialSummary ?? buildTitle(company, opportunityTitle));
      setAttendeeEmail(contactEmail || "");
      setFormality(defaultFormality);
      setDescription(initialDescription ?? descriptionFor(defaultFormality));
      descriptionDirtyRef.current = false;
    }
  }, [open, company, opportunityTitle, contactEmail, initialSummary, initialDescription, defaultFormality]);

  const handleFormalityChange = (next: Formality) => {
    if (next === formality) return;
    setFormality(next);
    // Toggling tu/vous always swaps the message to the matching template.
    setDescription(descriptionFor(next));
    descriptionDirtyRef.current = false;
  };



  const handleOpen = (v: boolean) => {
    if (!v) {
      setResult(null);
      setError(null);
    }
    onOpenChange(v);
  };

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Non authentifié."); return; }

      const startIso = toIso(date, startTime);
      const endIso = toIso(date, endTime);

      if (new Date(endIso) <= new Date(startIso)) {
        setError("L'heure de fin doit être après l'heure de début.");
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-events?action=create-event`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary: summary.trim(),
            description: description.trim(),
            startDateTime: startIso,
            endDateTime: endIso,
            attendeeEmail: attendeeEmail
              .split(/[,;\s]+/)
              .map((e) => e.trim())
              .filter(Boolean),
          }),
        }
      );

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Erreur lors de la création de l'événement.");
        return;
      }
      setResult({ htmlLink: data.htmlLink, meetLink: data.meetLink });
      onEventCreated?.(date, summary.trim());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="w-full sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5" />
            Créer un RDV Google Calendar
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="py-4 space-y-4">
            <p className="text-sm text-green-700 font-medium">Événement créé avec succès !</p>
            <div className="flex flex-col gap-2">
              <a
                href={result.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary underline"
              >
                <ExternalLink className="h-4 w-4" />
                Voir dans Google Calendar
              </a>
              {result.meetLink && (
                <a
                  href={result.meetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-primary underline"
                >
                  <Video className="h-4 w-4" />
                  Lien Google Meet
                </a>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => handleOpen(false)}>Fermer</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cal-summary">Titre</Label>
              <Input
                id="cal-summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5 col-span-3 sm:col-span-1">
                <Label htmlFor="cal-date">Date</Label>
                <Input
                  id="cal-date"
                  type="date"
                  value={date}
                  min={today}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cal-start">Début</Label>
                <Input
                  id="cal-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    const toMin = (t: string) => {
                      const [h, m] = t.split(":").map(Number);
                      return h * 60 + m;
                    };
                    const fromMin = (n: number) => {
                      const v = ((n % 1440) + 1440) % 1440;
                      return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
                    };
                    if (/^\d{2}:\d{2}$/.test(newStart)) {
                      const duration = toMin(endTime) - toMin(startTime);
                      setEndTime(fromMin(toMin(newStart) + (duration || 30)));
                    }
                    setStartTime(newStart);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cal-end">Fin</Label>
                <Input
                  id="cal-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cal-attendee">Emails des invités</Label>
              <Input
                id="cal-attendee"
                value={attendeeEmail}
                onChange={(e) => setAttendeeEmail(e.target.value)}
                placeholder="client@exemple.com, collegue@exemple.com"
              />
              <p className="text-xs text-muted-foreground">Séparez plusieurs emails par une virgule, un point-virgule ou un espace.</p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="cal-desc">Message</Label>
                <Tabs value={formality} onValueChange={(v) => handleFormalityChange(v as Formality)}>
                  <TabsList className="h-7">
                    <TabsTrigger value="tu" className="text-xs px-2 py-0.5">Tu</TabsTrigger>
                    <TabsTrigger value="vous" className="text-xs px-2 py-0.5">Vous</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <Textarea
                id="cal-desc"
                value={description}
                onChange={(e) => {
                  descriptionDirtyRef.current = true;
                  setDescription(e.target.value);
                }}
                rows={7}
                className="text-sm"
              />
            </div>


            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpen(false)} disabled={submitting}>
                Annuler
              </Button>
              <Button onClick={handleSubmit} disabled={submitting || !summary.trim() || !date}>
                {submitting ? <Spinner className="mr-2" /> : <CalendarPlus className="h-4 w-4 mr-2" />}
                Créer l'événement
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
