import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, Edit2, TrendingUp, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useDeleteOKRKeyResult,
  useCreateOKRKeyResult,
  useUpdateOKRKeyResult,
  useOKRInitiatives,
} from "@/hooks/useOKR";
import { OKRKeyResult, getConfidenceColor } from "@/types/okr";
import { OKRInitiativeRow, OKRInitiativeDialog } from "./OKRInitiativeSection";

// ---------------------------------------------------------------------------
// KeyResultCard
// ---------------------------------------------------------------------------

interface KeyResultCardProps {
  keyResult: OKRKeyResult;
  objectiveId: string;
  onEdit: () => void;
}

export function KeyResultCard({ keyResult, objectiveId, onEdit }: KeyResultCardProps) {
  const { toast } = useToast();
  const deleteKR = useDeleteOKRKeyResult();
  const { data: initiatives } = useOKRInitiatives(keyResult.id);
  const [showInitiatives, setShowInitiatives] = useState(false);
  const [showInitiativeDialog, setShowInitiativeDialog] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Supprimer ce résultat clé ?")) return;
    try {
      await deleteKR.mutateAsync({ id: keyResult.id, objectiveId });
      toast({ title: "Résultat clé supprimé" });
    } catch (error: unknown) {
      toast({ title: "Erreur", description: (error instanceof Error ? error.message : "Erreur inconnue"), variant: "destructive" });
    }
  };

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-medium">{keyResult.title}</h4>
          {keyResult.target_value && (
            <p className="text-sm text-muted-foreground">
              {keyResult.current_value} / {keyResult.target_value} {keyResult.unit}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <div className="flex-1">
          <Progress value={keyResult.progress_percentage} className="h-2" />
        </div>
        <span className="text-sm font-medium">{keyResult.progress_percentage}%</span>
        <Badge
          variant="outline"
          style={{
            borderColor: getConfidenceColor(keyResult.confidence_level),
            color: getConfidenceColor(keyResult.confidence_level),
          }}
        >
          {keyResult.confidence_level}%
        </Badge>
      </div>

      {/* Initiatives Section */}
      <div className="mt-3 pt-3 border-t">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowInitiatives(!showInitiatives)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <Zap className="h-4 w-4" />
            Initiatives ({initiatives?.length || 0})
          </button>
          <Button variant="ghost" size="sm" className="h-7" onClick={() => setShowInitiativeDialog(true)}>
            <Plus className="h-3 w-3 mr-1" />
            Ajouter
          </Button>
        </div>

        {showInitiatives && initiatives && initiatives.length > 0 && (
          <div className="mt-2 space-y-2">
            {initiatives.map((initiative) => (
              <OKRInitiativeRow key={initiative.id} initiative={initiative} keyResultId={keyResult.id} />
            ))}
          </div>
        )}
      </div>

      <OKRInitiativeDialog
        open={showInitiativeDialog}
        onOpenChange={setShowInitiativeDialog}
        keyResultId={keyResult.id}
        onCreated={() => setShowInitiatives(true)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// KeyResultDialog
// ---------------------------------------------------------------------------

interface KeyResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectiveId: string;
  editingKR: OKRKeyResult | null;
}

export function KeyResultDialog({ open, onOpenChange, objectiveId, editingKR }: KeyResultDialogProps) {
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
      toast({ title: "Erreur", description: (error instanceof Error ? error.message : "Erreur inconnue"), variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingKR ? "Modifier le résultat clé" : "Nouveau résultat clé"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Titre *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Atteindre 100 nouveaux clients" />
          </div>
          <div>
            <Label>Description</Label>
            <VoiceTextarea value={description} onValueChange={setDescription} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Valeur cible</Label>
              <Input type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder="100" />
            </div>
            <div>
              <Label>Valeur actuelle</Label>
              <Input type="number" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Unité</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="clients, €, %" />
            </div>
          </div>
          {editingKR && (
            <>
              <div>
                <Label>Progression: {progress}%</Label>
                <Slider value={[progress]} onValueChange={(v) => setProgress(v[0])} max={100} step={5} className="mt-2" />
              </div>
              <div>
                <Label>Confiance: {confidence}%</Label>
                <Slider value={[confidence]} onValueChange={(v) => setConfidence(v[0])} max={100} step={5} className="mt-2" />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={createKR.isPending || updateKR.isPending}>
            {(createKR.isPending || updateKR.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editingKR ? "Mettre à jour" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
