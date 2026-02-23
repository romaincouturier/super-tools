import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCreateOKRKeyResult, useUpdateOKRKeyResult } from "@/hooks/useOKR";
import { OKRKeyResult } from "@/types/okr";

interface KeyResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectiveId: string;
  editingKR: OKRKeyResult | null;
}

const KeyResultDialog = ({ open, onOpenChange, objectiveId, editingKR }: KeyResultDialogProps) => {
  const { toast } = useToast();
  const createKR = useCreateOKRKeyResult();
  const updateKR = useUpdateOKRKeyResult();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [unit, setUnit] = useState("");
  const [progress, setProgress] = useState(0);
  const [confidence, setConfidence] = useState(50);

  useEffect(() => {
    if (editingKR) {
      setTitle(editingKR.title);
      setDescription(editingKR.description || "");
      setTargetValue(editingKR.target_value?.toString() || "");
      setCurrentValue(editingKR.current_value.toString());
      setUnit(editingKR.unit || "");
      setProgress(editingKR.progress_percentage);
      setConfidence(editingKR.confidence_level);
    } else {
      setTitle("");
      setDescription("");
      setTargetValue("");
      setCurrentValue("0");
      setUnit("");
      setProgress(0);
      setConfidence(50);
    }
  }, [editingKR, open]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({ title: "Erreur", description: "Le titre est requis", variant: "destructive" });
      return;
    }

    try {
      if (editingKR) {
        await updateKR.mutateAsync({
          id: editingKR.id,
          objectiveId,
          updates: {
            title: title.trim(),
            description: description.trim() || null,
            target_value: targetValue ? parseFloat(targetValue) : null,
            current_value: parseFloat(currentValue) || 0,
            unit: unit.trim() || null,
            progress_percentage: progress,
            confidence_level: confidence,
          },
        });
        toast({ title: "Résultat clé mis à jour" });
      } else {
        await createKR.mutateAsync({
          objective_id: objectiveId,
          title: title.trim(),
          description: description.trim() || undefined,
          target_value: targetValue ? parseFloat(targetValue) : undefined,
          unit: unit.trim() || undefined,
        });
        toast({ title: "Résultat clé créé" });
      }
      onOpenChange(false);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingKR ? "Modifier le résultat clé" : "Nouveau résultat clé"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Titre *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Atteindre 100 nouveaux clients"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Valeur cible</Label>
              <Input
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="100"
              />
            </div>
            <div>
              <Label>Valeur actuelle</Label>
              <Input
                type="number"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Unité</Label>
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="clients, €, %"
              />
            </div>
          </div>
          {editingKR && (
            <>
              <div>
                <Label>Progression: {progress}%</Label>
                <Slider
                  value={[progress]}
                  onValueChange={(v) => setProgress(v[0])}
                  max={100}
                  step={5}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Confiance: {confidence}%</Label>
                <Slider
                  value={[confidence]}
                  onValueChange={(v) => setConfidence(v[0])}
                  max={100}
                  step={5}
                  className="mt-2"
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={createKR.isPending || updateKR.isPending}>
            {(createKR.isPending || updateKR.isPending) && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            {editingKR ? "Mettre à jour" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export { KeyResultDialog };
export type { KeyResultDialogProps };
