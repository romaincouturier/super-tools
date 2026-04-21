import { useState, useEffect, useMemo } from "react";
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
import { Input } from "@/components/ui/input";
import { GraduationCap, Plus, UserPlus, Search, Calendar, Building } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

interface Training {
  id: string;
  training_name: string;
  start_date: string;
  client_name: string;
  format_formation: string | null;
}

interface CreateTrainingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmCreate: () => void;
  onConfirmAddParticipant: (trainingId: string) => void;
  opportunityTitle: string;
  isFormation: boolean;
}

export function CreateTrainingDialog({
  open,
  onOpenChange,
  onConfirmCreate,
  onConfirmAddParticipant,
  opportunityTitle,
  isFormation,
}: CreateTrainingDialogProps) {
  const [mode, setMode] = useState<"choice" | "select-training">("choice");
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loadingTrainings, setLoadingTrainings] = useState(false);
  const [trainingSearch, setTrainingSearch] = useState("");

  // Reset mode when dialog opens/closes
  useEffect(() => {
    if (open) {
      setMode("choice");
      setTrainingSearch("");
    }
  }, [open]);

  // Fetch trainings when switching to select mode
  useEffect(() => {
    if (mode !== "select-training") return;
    const fetchTrainings = async () => {
      setLoadingTrainings(true);
      const { data, error } = await supabase
        .from("trainings")
        .select("id, training_name, start_date, client_name, format_formation")
        .eq("is_cancelled", false)
        .order("start_date", { ascending: false })
        .limit(100);

      if (!error && data) {
        setTrainings(data as any);
      }
      setLoadingTrainings(false);
    };
    fetchTrainings();
  }, [mode]);

  const filteredTrainings = useMemo(() => {
    if (!trainingSearch.trim()) return trainings;
    const q = trainingSearch.toLowerCase().trim();
    return trainings.filter(
      (t) =>
        t.training_name.toLowerCase().includes(q) ||
        t.client_name.toLowerCase().includes(q)
    );
  }, [trainings, trainingSearch]);

  // Choice screen
  if (mode === "choice") {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="w-full sm:max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-full bg-primary/10 text-primary">
                <GraduationCap className="h-5 w-5" />
              </div>
              <AlertDialogTitle>Opportunité gagnée !</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-left">
              L'opportunité <strong>"{opportunityTitle}"</strong> a été marquée comme gagnée.
              {isFormation && (
                <>
                  <br /><br />
                  Que souhaitez-vous faire ?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {isFormation ? (
            <div className="space-y-2 py-2">
              <Button
                variant="default"
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={onConfirmCreate}
              >
                <Plus className="h-4 w-4 shrink-0" />
                <div className="text-left">
                  <div className="font-medium">Créer une nouvelle formation</div>
                  <div className="text-xs font-normal opacity-80">
                    Les informations seront préremplies automatiquement
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={() => setMode("select-training")}
              >
                <UserPlus className="h-4 w-4 shrink-0" />
                <div className="text-left">
                  <div className="font-medium">Ajouter comme participant à une formation existante</div>
                  <div className="text-xs font-normal text-muted-foreground">
                    Sélectionnez la formation dans la liste
                  </div>
                </div>
              </Button>
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel>Non, plus tard</AlertDialogCancel>
            {!isFormation && (
              <Button onClick={onConfirmCreate}>
                Oui, créer la formation
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Select existing training screen
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-full sm:max-w-lg max-h-[80vh] flex flex-col">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-primary/10 text-primary">
              <UserPlus className="h-5 w-5" />
            </div>
            <AlertDialogTitle>Choisir une formation</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            Sélectionnez la formation à laquelle ajouter le participant.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 flex-1 min-h-0 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom ou client..."
              value={trainingSearch}
              onChange={(e) => setTrainingSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          {loadingTrainings ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="md" className="text-primary" />
            </div>
          ) : filteredTrainings.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              {trainingSearch ? `Aucune formation trouvée pour "${trainingSearch}"` : "Aucune formation disponible"}
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-1 border rounded-md p-1">
              {filteredTrainings.map((training) => (
                <button
                  key={training.id}
                  onClick={() => onConfirmAddParticipant(training.id)}
                  className="w-full text-left px-3 py-2.5 rounded-md hover:bg-muted/50 transition-colors flex items-start gap-3"
                >
                  <GraduationCap className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{training.training_name}</div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <Building className="h-3 w-3" />
                        {training.client_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(parseISO(training.start_date), "d MMM yyyy", { locale: fr })}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <Button variant="ghost" onClick={() => setMode("choice")}>
            Retour
          </Button>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
