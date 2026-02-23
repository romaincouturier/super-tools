import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Edit2, Trash2, Plus, Zap, X, Link, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useDeleteOKRKeyResult,
  useOKRInitiatives,
  useDeleteOKRInitiative,
  useUpdateOKRInitiative,
  useCreateOKRInitiative,
} from "@/hooks/useOKR";
import { useMissions } from "@/hooks/useMissions";
import { OKRKeyResult, OKRInitiative, okrStatusConfig, getConfidenceColor } from "@/types/okr";

interface KeyResultCardProps {
  keyResult: OKRKeyResult;
  objectiveId: string;
  onEdit: () => void;
}

const KeyResultCard = ({ keyResult, objectiveId, onEdit }: KeyResultCardProps) => {
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
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
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
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-500"
            onClick={handleDelete}
          >
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
          <Button
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={() => setShowInitiativeDialog(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Ajouter
          </Button>
        </div>

        {showInitiatives && initiatives && initiatives.length > 0 && (
          <div className="mt-2 space-y-2">
            {initiatives.map((initiative) => (
              <InitiativeRow
                key={initiative.id}
                initiative={initiative}
                keyResultId={keyResult.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Initiative Dialog */}
      <InitiativeDialog
        open={showInitiativeDialog}
        onOpenChange={setShowInitiativeDialog}
        keyResultId={keyResult.id}
        onCreated={() => setShowInitiatives(true)}
      />
    </div>
  );
};

// Initiative Row
const InitiativeRow = ({
  initiative,
  keyResultId,
}: {
  initiative: OKRInitiative;
  keyResultId: string;
}) => {
  const { toast } = useToast();
  const deleteInitiative = useDeleteOKRInitiative();
  const _updateInitiative = useUpdateOKRInitiative();

  const handleDelete = async () => {
    try {
      await deleteInitiative.mutateAsync({ id: initiative.id, keyResultId });
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex items-center gap-2 py-1 px-2 bg-muted/50 rounded text-sm">
      <Zap className="h-3 w-3 text-muted-foreground" />
      <span className="flex-1">{initiative.title}</span>
      {initiative.linked_mission && (
        <Badge variant="outline" className="text-xs">
          <Link className="h-3 w-3 mr-1" />
          Mission
        </Badge>
      )}
      {initiative.linked_training && (
        <Badge variant="outline" className="text-xs">
          <Link className="h-3 w-3 mr-1" />
          Formation
        </Badge>
      )}
      <Badge
        variant="outline"
        style={{
          borderColor: okrStatusConfig[initiative.status].color,
          color: okrStatusConfig[initiative.status].color,
        }}
      >
        {initiative.progress_percentage}%
      </Badge>
      <button onClick={handleDelete} className="text-red-500 hover:text-red-600">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
};

// Initiative Dialog
interface InitiativeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyResultId: string;
  onCreated?: () => void;
}

const InitiativeDialog = ({
  open,
  onOpenChange,
  keyResultId,
  onCreated,
}: InitiativeDialogProps) => {
  const { toast } = useToast();
  const createInitiative = useCreateOKRInitiative();
  const { data: missions } = useMissions();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [linkedMissionId, setLinkedMissionId] = useState("");

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({ title: "Erreur", description: "Le titre est requis", variant: "destructive" });
      return;
    }

    try {
      await createInitiative.mutateAsync({
        key_result_id: keyResultId,
        title: title.trim(),
        description: description.trim() || undefined,
        linked_mission_id: linkedMissionId || undefined,
      });
      toast({ title: "Initiative créée" });
      onOpenChange(false);
      setTitle("");
      setDescription("");
      setLinkedMissionId("");
      onCreated?.();
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
          <DialogTitle>Nouvelle Initiative</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Titre *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Lancer campagne marketing"
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
          <div>
            <Label>Lier à une mission</Label>
            <Select
              value={linkedMissionId || "none"}
              onValueChange={(val) => setLinkedMissionId(val === "none" ? "" : val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une mission" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune</SelectItem>
                {missions?.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={createInitiative.isPending}>
            {createInitiative.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export { KeyResultCard };
export type { KeyResultCardProps };
