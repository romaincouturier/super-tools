import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import PageLoading from "@/components/PageLoading";
import PageNotFound from "@/components/PageNotFound";
import PageHeader from "@/components/PageHeader";
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

  if (isLoading) return <PageLoading />;
  if (!event) return <PageNotFound message="Événement introuvable." backTo="/events" backLabel="Retour aux événements" />;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-2xl mx-auto p-6">
        <PageHeader icon={CalendarDays} title="Modifier l'événement" backTo={`/events/${id}`} />

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
