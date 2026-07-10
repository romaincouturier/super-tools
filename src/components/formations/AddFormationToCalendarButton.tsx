import { useState } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  buildFormationCalendarEvents,
  type FormationScheduleDay,
} from "@/lib/formationCalendarEvents";

interface Props {
  trainingId: string;
  trainingName: string;
  clientName: string | null;
  location: string;
  schedules: FormationScheduleDay[];
  isPresentiel: boolean;
  variant?: "outline" | "default";
  size?: "sm" | "default";
}

export default function AddFormationToCalendarButton({
  trainingId,
  trainingName,
  clientName,
  location,
  schedules,
  isPresentiel,
  variant = "outline",
  size = "default",
}: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (schedules.length === 0) {
      toast({
        title: "Aucun créneau",
        description: "Cette formation n'a pas de créneaux configurés.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Non authentifié", variant: "destructive" });
        return;
      }

      const events = buildFormationCalendarEvents({
        trainingId,
        trainingName,
        clientName,
        location,
        schedules,
        appUrl: window.location.origin,
        isPresentiel,
      });

      let ok = 0;
      let notConnected = false;
      const failures: string[] = [];

      for (const evt of events) {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-events?action=create-event`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(evt),
          },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error) {
          if (data.error === "Not connected") {
            notConnected = true;
            break;
          }
          failures.push(`${evt.summary} : ${data.error || res.status}`);
        } else {
          ok += 1;
        }
      }

      if (notConnected) {
        toast({
          title: "Google Calendar non connecté",
          description: "Connectez votre compte Google Calendar dans vos paramètres.",
          variant: "destructive",
        });
      } else if (failures.length > 0) {
        toast({
          title: `${ok} évènement(s) créé(s), ${failures.length} en échec`,
          description: failures.slice(0, 3).join(" · "),
          variant: "destructive",
        });
      } else {
        toast({
          title: "Ajouté au calendrier",
          description: `${ok} évènement(s) créé(s) dans Google Calendar.`,
        });
      }
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Impossible d'ajouter au calendrier.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant={variant} size={size} onClick={handleClick} disabled={loading}>
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <CalendarPlus className="h-4 w-4 mr-2" />
      )}
      Ajouter au calendrier
    </Button>
  );
}
