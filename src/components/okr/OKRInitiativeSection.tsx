import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import { Badge } from "@/components/ui/badge";
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
import { Zap, Link, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import {
  useCreateOKRInitiative,
  useDeleteOKRInitiative,
  useUpdateOKRInitiative,
} from "@/hooks/useOKR";
import { useMissions } from "@/hooks/useMissions";
import { OKRInitiative, okrStatusConfig } from "@/types/okr";

// ---------------------------------------------------------------------------
// InitiativeRow
// ---------------------------------------------------------------------------

export function OKRInitiativeRow({ initiative, keyResultId }: { initiative: OKRInitiative; keyResultId: string }) {
  const { toast } = useToast();
  const deleteInitiative = useDeleteOKRInitiative();

  const handleDelete = async () => {
    try {
      await deleteInitiative.mutateAsync({ id: initiative.id, keyResultId });
    } catch (error: unknown) {
      toastError(toast, error instanceof Error ? error : "Erreur inconnue");
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
}

// ---------------------------------------------------------------------------
// InitiativeDialog
// ---------------------------------------------------------------------------

interface InitiativeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyResultId: string;
  onCreated?: () => void;
}

export function OKRInitiativeDialog({ open, onOpenChange, keyResultId, onCreated }: InitiativeDialogProps) {
  const { toast } = useToast();
  const createInitiative = useCreateOKRInitiative();
  const { data: missions } = useMissions();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [linkedMissionId, setLinkedMissionId] = useState("");

  const handleSubmit = async () => {
    if (!title.trim()) {
      toastError(toast, "Le titre est requis");
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
      toastError(toast, error instanceof Error ? error : "Erreur inconnue");
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
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Lancer campagne marketing" />
          </div>
          <div>
            <Label>Description</Label>
            <VoiceTextarea value={description} onValueChange={setDescription} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Lier à une mission</Label>
            <Select value={linkedMissionId || "none"} onValueChange={(val) => setLinkedMissionId(val === "none" ? "" : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une mission" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune</SelectItem>
                {missions?.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={createInitiative.isPending}>
            {createInitiative.isPending && <Spinner className="mr-2" />}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
