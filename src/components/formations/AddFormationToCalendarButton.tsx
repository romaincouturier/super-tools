import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { useAddFormationToCalendar } from "@/hooks/useAddFormationToCalendar";
import type { FormationScheduleDay } from "@/lib/formationCalendarEvents";

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
  const { loading, addToCalendar } = useAddFormationToCalendar();

  const handleClick = async () => {
    if (schedules.length === 0) {
      toast({
        title: "Aucun créneau",
        description: "Cette formation n'a pas de créneaux configurés.",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await addToCalendar({
        trainingId,
        trainingName,
        clientName,
        location,
        schedules,
        isPresentiel,
      });

      if (result.noSession) {
        toast({ title: "Non authentifié", variant: "destructive" });
      } else if (result.notConnected) {
        toast({
          title: "Google Calendar non connecté",
          description: "Connectez votre compte Google Calendar dans vos paramètres.",
          variant: "destructive",
        });
      } else if (result.failures.length > 0) {
        toast({
          title: `${result.ok} évènement(s) créé(s), ${result.failures.length} en échec`,
          description: result.failures.slice(0, 3).join(" · "),
          variant: "destructive",
        });
      } else {
        toast({
          title: "Ajouté au calendrier",
          description: `${result.ok} évènement(s) créé(s) dans Google Calendar.`,
        });
      }
    } catch (e) {
      toastError(toast, "Impossible d'ajouter au calendrier.", { cause: e });
    }
  };

  return (
    <Button variant={variant} size={size} onClick={handleClick} disabled={loading}>
      {loading ? (
        <Spinner className="mr-2" />
      ) : (
        <CalendarPlus className="h-4 w-4 mr-2" />
      )}
      Ajouter au calendrier
    </Button>
  );
}
