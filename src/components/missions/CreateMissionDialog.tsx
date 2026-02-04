import { useState } from "react";
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
}

const CreateMissionDialog = ({
  open,
  onOpenChange,
  defaultStatus = "not_started",
}: CreateMissionDialogProps) => {
  const createMission = useCreateMission();
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    await createMission.mutateAsync({
      title: title.trim(),
      client_name: clientName.trim() || undefined,
      status: defaultStatus,
    });

    setTitle("");
    setClientName("");
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
            <Label>Client (optionnel)</Label>
            <Input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nom du client"
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
