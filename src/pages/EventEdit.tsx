import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CalendarDays, Send } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import ModuleLayout from "@/components/ModuleLayout";
import PageLoading from "@/components/PageLoading";
import PageNotFound from "@/components/PageNotFound";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import EventFormFields, { type EventFormValues } from "@/components/events/EventFormFields";
import { useToast } from "@/hooks/use-toast";
import { useEvent, useUpdateEvent } from "@/hooks/useEvents";
import AssignedUserSelector from "@/components/formations/AssignedUserSelector";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useEdgeFunction } from "@/hooks/useEdgeFunction";
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm";

type ChangeMap = Record<string, { old: string | null; new: string | null }>;

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
    privateGroupUrl: "",
  });

  // For change detection (notification)
  const originalRef = useRef<Record<string, string | null> | null>(null);

  // Notify dialog state
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<ChangeMap>({});
  const [sharesCount, setSharesCount] = useState(0);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const { loading: notifying, invoke: invokeSendUpdate } = useEdgeFunction(
    "send-event-update-email",
    { errorMessage: "Erreur inconnue" },
  );

  const prevEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (event && event.id !== prevEventIdRef.current) {
      prevEventIdRef.current = event.id;
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
        privateGroupUrl: (event as unknown as { private_group_url?: string }).private_group_url || "",
      });
      setAssignedTo(event.assigned_to || null);
      originalRef.current = {
        title: event.title,
        description: event.description,
        event_date: event.event_date,
        event_time: event.event_time,
        location: event.location,
        location_type: event.location_type,
        event_type: event.event_type,
        cfp_deadline: event.cfp_deadline,
        event_url: event.event_url,
        cfp_url: event.cfp_url,
      };
      resetTracking();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  // Fetch shares count
  useEffect(() => {
    if (!id) return;
    (supabase as unknown as { from: (table: string) => ReturnType<typeof supabase.from> })
      .from("event_shares")
      .select("id", { count: "exact", head: true })
      .eq("event_id", id)
      .then(({ count }: { count: number | null }) => {
        setSharesCount(count || 0);
      });
  }, [id]);

  const handleChange = useCallback(<K extends keyof EventFormValues>(field: K, value: EventFormValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const buildNewValues = useCallback(() => {
    const isExternal = values.eventType === "external";
    const isInternalVisio = values.eventType === "internal" && values.locationType === "visio";
    return {
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
      private_group_url: isInternalVisio && values.privateGroupUrl.trim() ? values.privateGroupUrl.trim() : null,
      assigned_to: assignedTo,
    };
  }, [values, assignedTo]);

  // Auto-save via useAutoSaveForm
  const handleAutoSave = useCallback(async () => {
    if (!id || !values.title.trim() || !values.eventDate) return false;
    try {
      await updateEvent.mutateAsync({ id, ...buildNewValues() });
      return true;
    } catch {
      return false;
    }
  }, [id, values.title, values.eventDate, updateEvent, buildNewValues]);

  const formValues = useMemo(() => ({ ...values, assignedTo }), [values, assignedTo]);

  const { autoSaving, resetTracking, flushAndGetPending } = useAutoSaveForm({
    open: !!event,
    formValues,
    onSave: handleAutoSave,
  });

  const detectChanges = (newVals: Record<string, string | null>): ChangeMap => {
    const orig = originalRef.current;
    if (!orig) return {};
    const changes: ChangeMap = {};
    for (const key of Object.keys(newVals)) {
      const oldVal = orig[key] ?? null;
      const newVal = newVals[key] ?? null;
      if ((oldVal || "") !== (newVal || "")) {
        changes[key] = { old: oldVal, new: newVal };
      }
    }
    return changes;
  };

  const handleBack = async () => {
    // Flush any pending auto-save
    const pending = flushAndGetPending();
    if (pending && id) {
      try {
        await updateEvent.mutateAsync({ id, ...buildNewValues() });
      } catch { /* ignore */ }
    }

    // Check if we need to notify shared recipients
    const newVals = buildNewValues();
    const changes = detectChanges(newVals);
    if (sharesCount > 0 && Object.keys(changes).length > 0) {
      setPendingChanges(changes);
      setNotifyDialogOpen(true);
    } else {
      navigate(`/events/${id}`);
    }
  };

  const handleNotify = async () => {
    const result = await invokeSendUpdate({ event_id: id, changes: pendingChanges });
    if (result !== null) {
      toast({
        title: "Relance envoyée",
        description: `${sharesCount} personne(s) notifiée(s) des modifications.`,
      });
    }
    setNotifyDialogOpen(false);
    navigate(`/events/${id}`);
  };

  const handleSkipNotify = () => {
    setNotifyDialogOpen(false);
    navigate(`/events/${id}`);
  };

  if (isLoading) return <PageLoading />;
  if (!event) return <PageNotFound message="Événement introuvable." backTo="/events" backLabel="Retour aux événements" />;

  return (
    <ModuleLayout>

      <main className="max-w-2xl mx-auto p-6">
        <PageHeader
          icon={CalendarDays}
          title="Modifier l'événement"
          backTo={`/events/${id}`}
          onBackClick={handleBack}
          actions={
            <>
              {(autoSaving || updateEvent.isPending) && (
                <Spinner className="text-muted-foreground" />
              )}
            </>
          }
        />

        <EventFormFields values={values} onChange={handleChange} />

        <div className="space-y-2 mt-6">
          <Label>Assigné à</Label>
          <AssignedUserSelector value={assignedTo} onChange={setAssignedTo} />
        </div>
      </main>

      {/* Notify shared recipients dialog */}
      <AlertDialog open={notifyDialogOpen} onOpenChange={setNotifyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Prévenir les destinataires ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cet événement a été partagé avec {sharesCount} personne(s).
              Souhaitez-vous leur envoyer un email indiquant les modifications apportées ?
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Preview changes */}
          <div className="rounded-md border bg-muted/50 p-3 text-sm space-y-1 max-h-48 overflow-y-auto">
            {Object.entries(pendingChanges).map(([field, { old: oldVal, new: newVal }]) => {
              const labels: Record<string, string> = {
                title: "Titre", description: "Description", event_date: "Date",
                event_time: "Heure", location: "Lieu", location_type: "Type de lieu",
                event_type: "Type", cfp_deadline: "Deadline CFP",
                event_url: "URL événement", cfp_url: "URL CFP",
              };
              return (
                <div key={field}>
                  <span className="font-medium">{labels[field] || field}</span>
                  {" : "}
                  <span className="line-through text-muted-foreground">{oldVal || "—"}</span>
                  {" → "}
                  <span className="text-foreground">{newVal || "—"}</span>
                </div>
              );
            })}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleSkipNotify} disabled={notifying}>
              Non, merci
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleNotify} disabled={notifying}>
              {notifying ? (
                <Spinner className="mr-1" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              Envoyer la relance
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ModuleLayout>
  );
};

export default EventEdit;
