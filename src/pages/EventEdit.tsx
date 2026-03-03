import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarDays, Loader2, ExternalLink } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useEvent, useUpdateEvent } from "@/hooks/useEvents";

const EventEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: event, isLoading } = useEvent(id);
  const updateEvent = useUpdateEvent();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [location, setLocation] = useState("");
  const [locationType, setLocationType] = useState<"physical" | "visio">("physical");
  const [eventType, setEventType] = useState<"internal" | "external">("internal");
  const [cfpDeadline, setCfpDeadline] = useState("");
  const [eventUrl, setEventUrl] = useState("");
  const [cfpUrl, setCfpUrl] = useState("");

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description || "");
      setEventDate(event.event_date);
      setEventTime(event.event_time?.slice(0, 5) || "");
      setLocation(event.location || "");
      setLocationType(event.location_type);
      setEventType(event.event_type || "internal");
      setCfpDeadline(event.cfp_deadline || "");
      setEventUrl(event.event_url || "");
      setCfpUrl(event.cfp_url || "");
    }
  }, [event]);

  const handleSubmit = async () => {
    if (!id || !title.trim() || !eventDate) {
      toast({
        title: "Champs requis",
        description: "Le nom et la date sont obligatoires.",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateEvent.mutateAsync({
        id,
        title: title.trim(),
        description: description.trim() || null,
        event_date: eventDate,
        event_time: eventTime || null,
        location: location.trim() || null,
        location_type: locationType,
        event_type: eventType,
        cfp_deadline: eventType === "external" && cfpDeadline ? cfpDeadline : null,
        event_url: eventType === "external" && eventUrl.trim() ? eventUrl.trim() : null,
        cfp_url: eventType === "external" && cfpUrl.trim() ? cfpUrl.trim() : null,
      });
      toast({ title: "Événement mis à jour" });
      navigate(`/events/${id}`);
    } catch (error) {
      console.error("Error updating event:", error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour l'événement.",
        variant: "destructive",
      });
    }
  };

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

  if (!event) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="max-w-2xl mx-auto p-6 text-center py-20 text-muted-foreground">
          <p>Événement introuvable.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/events")}>
            Retour aux événements
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-2xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/events/${id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <CalendarDays className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Modifier l'événement</h1>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">
              Nom de l'événement <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Conférence IA et Formation"
            />
          </div>

          <div className="space-y-2">
            <Label>Type d'événement</Label>
            <RadioGroup
              value={eventType}
              onValueChange={(v) => setEventType(v as "internal" | "external")}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="internal" id="internal" />
                <Label htmlFor="internal" className="cursor-pointer">Interne</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="external" id="external" />
                <Label htmlFor="external" className="cursor-pointer">Externe</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description de l'événement…"
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="eventDate">
                Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="eventDate"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eventTime">Heure</Label>
              <Input
                id="eventTime"
                type="time"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Type de lieu</Label>
            <RadioGroup
              value={locationType}
              onValueChange={(v) => setLocationType(v as "physical" | "visio")}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="physical" id="physical" />
                <Label htmlFor="physical" className="cursor-pointer">Adresse physique</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="visio" id="visio" />
                <Label htmlFor="visio" className="cursor-pointer">Visioconférence</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">
              {locationType === "physical" ? "Adresse" : "Lien de visioconférence"}
            </Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={
                locationType === "physical"
                  ? "Ex: 10 rue de la Paix, 75002 Paris"
                  : "Ex: https://meet.google.com/abc-defg-hij"
              }
            />
          </div>

          {eventType === "external" && (
            <div className="space-y-4 p-4 rounded-lg border border-blue-200 bg-blue-50/50">
              <p className="text-sm font-medium text-blue-700 flex items-center gap-1">
                <ExternalLink className="h-4 w-4" />
                Informations événement externe
              </p>
              <div className="space-y-2">
                <Label htmlFor="eventUrl">Lien vers l'événement</Label>
                <Input
                  id="eventUrl"
                  value={eventUrl}
                  onChange={(e) => setEventUrl(e.target.value)}
                  placeholder="https://www.conference-example.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cfpUrl">Lien vers le CFP</Label>
                  <Input
                    id="cfpUrl"
                    value={cfpUrl}
                    onChange={(e) => setCfpUrl(e.target.value)}
                    placeholder="https://www.conference-example.com/cfp"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cfpDeadline">Date limite CFP</Label>
                  <Input
                    id="cfpDeadline"
                    type="date"
                    value={cfpDeadline}
                    onChange={(e) => setCfpDeadline(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => navigate(`/events/${id}`)}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={updateEvent.isPending}>
              Enregistrer
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EventEdit;
