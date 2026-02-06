import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarDays } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useCreateEvent } from "@/hooks/useEvents";

const EventCreate = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const createEvent = useCreateEvent();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [location, setLocation] = useState("");
  const [locationType, setLocationType] = useState<"physical" | "visio">("physical");

  const handleSubmit = async () => {
    if (!title.trim() || !eventDate) {
      toast({
        title: "Champs requis",
        description: "Le nom et la date sont obligatoires.",
        variant: "destructive",
      });
      return;
    }

    try {
      const event = await createEvent.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        event_date: eventDate,
        event_time: eventTime || null,
        location: location.trim() || null,
        location_type: locationType,
      });
      toast({ title: "Événement créé" });
      navigate(`/events/${event.id}`);
    } catch (error) {
      console.error("Error creating event:", error);
      toast({
        title: "Erreur",
        description: "Impossible de créer l'événement.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-2xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/events")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <CalendarDays className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Nouvel événement</h1>
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
            <Button variant="outline" onClick={() => navigate("/events")}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={createEvent.isPending}>
              Créer l'événement
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EventCreate;
