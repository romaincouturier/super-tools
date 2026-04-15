import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Trash2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { useAddOKRParticipant, useRemoveOKRParticipant } from "@/hooks/useOKR";

// ---------------------------------------------------------------------------
// ParticipantRow
// ---------------------------------------------------------------------------

export function OKRParticipantRow({ participant, objectiveId }: { participant: any; objectiveId: string }) {
  const { toast } = useToast();
  const removeParticipant = useRemoveOKRParticipant();

  const handleRemove = async () => {
    try {
      await removeParticipant.mutateAsync({ id: participant.id, objectiveId });
    } catch (error: unknown) {
      toast({ title: "Erreur", description: (error instanceof Error ? error.message : "Erreur inconnue"), variant: "destructive" });
    }
  };

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div>
        <div className="font-medium">{participant.name || participant.email}</div>
        {participant.name && (
          <div className="text-sm text-muted-foreground">{participant.email}</div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline">{participant.role}</Badge>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={handleRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ParticipantDialog
// ---------------------------------------------------------------------------

interface ParticipantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectiveId: string;
}

export function OKRParticipantDialog({ open, onOpenChange, objectiveId }: ParticipantDialogProps) {
  const { toast } = useToast();
  const addParticipant = useAddOKRParticipant();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("contributor");

  const handleSubmit = async () => {
    if (!email.trim()) {
      toast({ title: "Erreur", description: "L'email est requis", variant: "destructive" });
      return;
    }

    try {
      await addParticipant.mutateAsync({
        objective_id: objectiveId,
        email: email.trim(),
        name: name.trim() || undefined,
        role,
      });
      toast({ title: "Participant ajouté" });
      onOpenChange(false);
      setEmail("");
      setName("");
      setRole("contributor");
    } catch (error: unknown) {
      toast({ title: "Erreur", description: (error instanceof Error ? error.message : "Erreur inconnue"), variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un participant</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Email *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
          </div>
          <div>
            <Label>Nom</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Prénom Nom" />
          </div>
          <div>
            <Label>Rôle</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Responsable</SelectItem>
                <SelectItem value="contributor">Contributeur</SelectItem>
                <SelectItem value="observer">Observateur</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={addParticipant.isPending}>
            {addParticipant.isPending && <Spinner className="mr-2" />}
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
