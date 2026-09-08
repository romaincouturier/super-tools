import { CalendarPlus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { useAddEventToGoogleCalendar } from "@/hooks/useAddEventToGoogleCalendar";
import type { Event } from "@/types/events";

interface Props {
  event: Event;
}

/** Ajoute l'évènement dans le Google Agenda de l'utilisateur connecté. */
export default function AddEventToGoogleCalendarButton({ event }: Props) {
  const { toast } = useToast();
  const { loading, addEvent } = useAddEventToGoogleCalendar();

  const handleClick = async () => {
    try {
      const result = await addEvent(event);

      if (result.noSession) {
        toastError(toast, "Session expirée, reconnectez-vous.");
        return;
      }
      if (result.notConnected) {
        toastError(
          toast,
          "Votre Google Agenda n'est pas encore connecté. Connectez-le dans les paramètres.",
        );
        return;
      }
      if (!result.ok) {
        toastError(toast, result.error || "Impossible d'ajouter l'évènement à votre agenda.");
        return;
      }

      toast({ title: "Ajouté à votre Google Agenda" });
    } catch (err: unknown) {
      toastError(
        toast,
        err instanceof Error ? err : "Impossible d'ajouter l'évènement à votre agenda.",
      );
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
