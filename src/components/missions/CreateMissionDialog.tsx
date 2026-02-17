import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { MissionStatus } from "@/types/missions";
import { useCreateMission } from "@/hooks/useMissions";

interface CreateMissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStatus?: MissionStatus;
  prefillTitle?: string;
  prefillClientName?: string;
  prefillClientContact?: string;
  prefillTotalAmount?: string;
}

const CreateMissionDialog = ({
  open,
  onOpenChange,
  defaultStatus = "not_started",
  prefillTitle,
  prefillClientName,
  prefillClientContact,
  prefillTotalAmount,
}: CreateMissionDialogProps) => {
  const createMission = useCreateMission();
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientContact, setClientContact] = useState("");
  const [totalAmount, setTotalAmount] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(prefillTitle || "");
      setClientName(prefillClientName || "");
      setClientContact(prefillClientContact || "");
      setTotalAmount(prefillTotalAmount || "");
    }
  }, [open, prefillTitle, prefillClientName, prefillClientContact, prefillTotalAmount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    await createMission.mutateAsync({
      title: title.trim(),
      client_name: clientName.trim() || undefined,
      client_contact: clientContact.trim() || undefined,
      initial_amount: totalAmount ? parseFloat(totalAmount) || undefined : undefined,
      status: defaultStatus,
    });

    setTitle("");
    setClientName("");
    setClientContact("");
    setTotalAmount("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle mission</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Titre de la mission</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Développement application mobile"
              autoFocus
            />
          </div>
          <div>
            <Label>Entreprise</Label>
            <Input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nom de l'entreprise"
            />
          </div>
          <div>
            <Label>Contact (nom, email...)</Label>
            <Input
              value={clientContact}
              onChange={(e) => setClientContact(e.target.value)}
              placeholder="Ex: Jean Dupont jean@exemple.com"
            />
          </div>
          <div>
            <Label>Montant initial (€)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={!title.trim() || createMission.isPending}>
              {createMission.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Créer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateMissionDialog;
