import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { Spinner } from "@/components/ui/spinner";
import OKRAICheckInDraft from "./OKRAICheckInDraft";
import { useToast } from "@/hooks/use-toast";
import { useCreateOKRCheckIn } from "@/hooks/useOKR";
import { OKRObjective } from "@/types/okr";

interface CheckInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objective: OKRObjective;
}

export function OKRCheckInDialog({ open, onOpenChange, objective }: CheckInDialogProps) {
  const { toast } = useToast();
  const createCheckIn = useCreateOKRCheckIn();

  const [progress, setProgress] = useState(objective.progress_percentage);
  const [confidence, setConfidence] = useState(objective.confidence_level);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setProgress(objective.progress_percentage);
    setConfidence(objective.confidence_level);
    setNotes("");
  }, [objective, open]);

  const handleSubmit = async () => {
    try {
      await createCheckIn.mutateAsync({
        objective_id: objective.id,
        new_progress: progress,
        new_confidence: confidence,
        notes: notes.trim() || undefined,
      });
      toast({ title: "Suivi enregistré" });
      onOpenChange(false);
    } catch (error: unknown) {
      toast({ title: "Erreur", description: (error instanceof Error ? error.message : "Erreur inconnue"), variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Nouveau suivi</DialogTitle>
            <OKRAICheckInDraft
              objectiveId={objective.id}
              year={objective.target_year}
              onDraftReady={(draft) => {
                setProgress(draft.suggested_progress);
                setConfidence(draft.suggested_confidence);
                setNotes(draft.suggested_notes);
              }}
            />
          </div>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Progression: {progress}%</Label>
            <Slider value={[progress]} onValueChange={(v) => setProgress(v[0])} max={100} step={5} className="mt-2" />
          </div>
          <div>
            <Label>Niveau de confiance: {confidence}%</Label>
            <Slider value={[confidence]} onValueChange={(v) => setConfidence(v[0])} max={100} step={5} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              Quelle est votre confiance dans l'atteinte de cet objectif ?
            </p>
          </div>
          <div>
            <Label>Notes</Label>
            <VoiceTextarea
              value={notes}
              onValueChange={setNotes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Commentaires, obstacles rencontrés, prochaines étapes..."
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={createCheckIn.isPending}>
            {createCheckIn.isPending && <Spinner className="mr-2" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
