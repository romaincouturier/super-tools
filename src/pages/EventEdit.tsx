import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarDays, Loader2 } from "lucide-react";
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

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description || "");
      setEventDate(event.event_date);
      setEventTime(event.event_time?.slice(0, 5) || "");
      setLocation(event.location || "");
      setLocationType(event.location_type);
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
