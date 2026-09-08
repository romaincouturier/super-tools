import { useState } from "react";
import { CalendarPlus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import type { Event } from "@/types/events";

interface Props {
  event: Event;
}

/** Ajoute l'évènement dans le Google Agenda de l'utilisateur connecté. */
export default function AddEventToGoogleCalendarButton({ event }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toastError(toast, "Session expirée, reconnectez-vous.");
        return;
      }

      const time = event.event_time ? event.event_time.slice(0, 5) : "09:00";
      const start = new Date(`${event.event_date}T${time}:00`);
      const end = new Date(start.getTime() + 60 * 60 * 1000);

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-events?action=create-event`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary: event.title,
            description: [event.description, event.event_url].filter(Boolean).join("\n\n"),
            location: event.location || "",
            startDateTime: start.toISOString(),
            endDateTime: end.toISOString(),
          }),
        },
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.error) {
        if (data.error === "Not connected") {
          toastError(
            toast,
            "Votre Google Agenda n'est pas encore connecté. Connectez-le dans les paramètres.",
          );
          return;
        }
        toastError(toast, data.error || "Impossible d'ajouter l'évènement à votre agenda.");
        return;
      }

      toast({
        title: "Ajouté à votre Google Agenda",
        description: data.htmlLink ? "Cliquez sur le lien dans Google pour le retrouver." : undefined,
      });
    } catch (err: unknown) {
      toastError(toast, err instanceof Error ? err : "Impossible d'ajouter l'évènement à votre agenda.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={loading}>
      {loading ? (
        <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
      ) : (
        <CalendarPlus className="h-4 w-4 mr-1" />
      )}
      Google Agenda
    </Button>
  );
}
