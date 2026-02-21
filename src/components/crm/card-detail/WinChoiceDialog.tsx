import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  ChevronDown,
  GraduationCap,
  Loader2,
  Rocket,
  Trophy,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

interface WinChoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onCreateTraining: () => void;
  onCreateMission: () => void;
  onAttachToTraining: (trainingId: string) => void;
}

const WinChoiceDialog = ({
  open,
  onOpenChange,
  title,
  onCreateTraining,
  onCreateMission,
  onAttachToTraining,
}: WinChoiceDialogProps) => {
  const [showAttachTraining, setShowAttachTraining] = useState(false);
  const [interTrainings, setInterTrainings] = useState<Array<{
    id: string;
    training_name: string;
    start_date: string;
    client_name: string;
    format_formation: string | null;
  }>>([]);
  const [interTrainingsLoading, setInterTrainingsLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setShowAttachTraining(false);
      return;
    }
    const fetchInterTrainings = async () => {
      setInterTrainingsLoading(true);
      const today = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("trainings")
        .select("id, training_name, start_date, client_name, format_formation")
        .in("format_formation", ["inter-entreprises", "e_learning"])
        .gte("start_date", today)
        .order("start_date", { ascending: true })
        .limit(50);

      if (!error && data) {
        setInterTrainings(data);
      }
      setInterTrainingsLoading(false);
    };
    fetchInterTrainings();
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-green-100 text-green-600">
              <Trophy className="h-5 w-5" />
            </div>
            <AlertDialogTitle>Opportunité gagnée !</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left">
            L'opportunité <strong>"{title}"</strong> a été marquée comme gagnée.
            <br /><br />
            Que souhaitez-vous créer à partir de cette opportunité ?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <Button
            variant="outline"
            className="h-auto flex flex-col items-center gap-2 p-4 hover:border-primary hover:bg-primary/5"
            onClick={onCreateTraining}
          >
            <GraduationCap className="h-8 w-8 text-primary" />
            <span className="font-medium">Créer une formation</span>
            <span className="text-xs text-muted-foreground text-center">Préremplir avec les infos de l'opportunité</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto flex flex-col items-center gap-2 p-4 hover:border-purple-500 hover:bg-purple-50"
            onClick={onCreateMission}
          >
            <Rocket className="h-8 w-8 text-purple-600" />
            <span className="font-medium">Créer une mission</span>
            <span className="text-xs text-muted-foreground text-center">Préremplir avec les infos de l'opportunité</span>
          </Button>
        </div>

        {/* Attach to existing inter-entreprise training */}
        <div className="border-t pt-3">
          <button
            className="w-full flex items-center justify-between text-sm font-medium text-left px-1 py-1 hover:text-primary transition-colors"
            onClick={() => setShowAttachTraining(!showAttachTraining)}
          >
            <span className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Attacher à une formation inter-entreprise existante
            </span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", showAttachTraining && "rotate-180")} />
          </button>

          {showAttachTraining && (
            <div className="mt-2 space-y-2">
              {interTrainingsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : interTrainings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">
                  Aucune formation inter-entreprise à venir
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-1">
                  {interTrainings.map((training) => (
                    <button
                      key={training.id}
                      onClick={() => onAttachToTraining(training.id)}
                      className="w-full text-left px-3 py-2.5 rounded-md hover:bg-muted/50 transition-colors flex items-start gap-3"
                    >
                      <GraduationCap className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{training.training_name}</div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(parseISO(training.start_date), "d MMM yyyy", { locale: fr })}
                          </span>
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                            Inter-entreprises
                          </Badge>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Non, plus tard</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default WinChoiceDialog;
