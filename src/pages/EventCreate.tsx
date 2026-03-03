import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarDays } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import EventFormFields, { type EventFormValues } from "@/components/events/EventFormFields";
import { useToast } from "@/hooks/use-toast";
import { useCreateEvent } from "@/hooks/useEvents";

const INITIAL_VALUES: EventFormValues = {
  title: "",
  description: "",
  eventDate: "",
  eventTime: "",
  location: "",
  locationType: "physical",
  eventType: "internal",
  cfpDeadline: "",
  eventUrl: "",
  cfpUrl: "",
};

const EventCreate = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const createEvent = useCreateEvent();

  const [values, setValues] = useState<EventFormValues>(INITIAL_VALUES);

  const handleChange = useCallback(<K extends keyof EventFormValues>(field: K, value: EventFormValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = async () => {
    if (!values.title.trim() || !values.eventDate) {
      toast({
        title: "Champs requis",
        description: "Le nom et la date sont obligatoires.",
        variant: "destructive",
      });
      return;
    }

    const isExternal = values.eventType === "external";
    try {
      const event = await createEvent.mutateAsync({
        title: values.title.trim(),
        description: values.description.trim() || null,
        event_date: values.eventDate,
        event_time: values.eventTime || null,
        location: values.location.trim() || null,
        location_type: values.locationType,
        event_type: values.eventType,
        cfp_deadline: isExternal && values.cfpDeadline ? values.cfpDeadline : null,
        event_url: isExternal && values.eventUrl.trim() ? values.eventUrl.trim() : null,
        cfp_url: isExternal && values.cfpUrl.trim() ? values.cfpUrl.trim() : null,
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
        <EventFormFields values={values} onChange={handleChange} />

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => navigate("/events")}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={createEvent.isPending}>
            Créer l'événement
          </Button>
        </div>
      </main>
    </div>
  );
};

export default EventCreate;
