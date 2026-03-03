import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarDays, Loader2 } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import EventFormFields, { type EventFormValues } from "@/components/events/EventFormFields";
import { useToast } from "@/hooks/use-toast";
import { useEvent, useUpdateEvent } from "@/hooks/useEvents";

const EventEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: event, isLoading } = useEvent(id);
  const updateEvent = useUpdateEvent();

  const [values, setValues] = useState<EventFormValues>({
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
  });

  useEffect(() => {
    if (event) {
      setValues({
        title: event.title,
        description: event.description || "",
        eventDate: event.event_date,
        eventTime: event.event_time?.slice(0, 5) || "",
        location: event.location || "",
        locationType: event.location_type,
        eventType: event.event_type || "internal",
        cfpDeadline: event.cfp_deadline || "",
        eventUrl: event.event_url || "",
        cfpUrl: event.cfp_url || "",
      });
    }
  }, [event]);

  const handleChange = useCallback(<K extends keyof EventFormValues>(field: K, value: EventFormValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = async () => {
    if (!id || !values.title.trim() || !values.eventDate) {
      toast({
        title: "Champs requis",
        description: "Le nom et la date sont obligatoires.",
        variant: "destructive",
      });
      return;
    }

    const isExternal = values.eventType === "external";
    try {
      await updateEvent.mutateAsync({
        id,
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
        <EventFormFields values={values} onChange={handleChange} />

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => navigate(`/events/${id}`)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={updateEvent.isPending}>
            Enregistrer
          </Button>
        </div>
      </main>
    </div>
  );
};

export default EventEdit;
