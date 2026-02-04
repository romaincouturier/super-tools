import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useCreateCard } from "@/hooks/useCrmBoard";
import { useAuth } from "@/hooks/useAuth";
import { CrmColumn, StatusOperational, SalesStatus } from "@/types/crm";

interface CreateCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnId: string;
  columns: CrmColumn[];
}

const CreateCardDialog = ({ open, onOpenChange, columnId, columns }: CreateCardDialogProps) => {
  const { user } = useAuth();
  const createCard = useCreateCard();

  const [title, setTitle] = useState("");
  const [selectedColumnId, setSelectedColumnId] = useState(columnId);
  const [estimatedValue, setEstimatedValue] = useState("");
  const [statusOperational, setStatusOperational] = useState<StatusOperational>("TODAY");
  const [waitingDate, setWaitingDate] = useState("");
  const [waitingText, setWaitingText] = useState("");

  // Reset form when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setTitle("");
      setSelectedColumnId(columnId);
      setEstimatedValue("");
      setStatusOperational("TODAY");
      setWaitingDate("");
      setWaitingText("");
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user?.email) return;

    // Validation: if WAITING, date and text are required
    if (statusOperational === "WAITING" && (!waitingDate || !waitingText.trim())) {
      return;
    }

    await createCard.mutateAsync({
      input: {
        column_id: selectedColumnId || columnId,
        title: title.trim(),
        estimated_value: estimatedValue ? parseFloat(estimatedValue) : 0,
        status_operational: statusOperational,
        waiting_next_action_date: statusOperational === "WAITING" ? waitingDate : undefined,
        waiting_next_action_text: statusOperational === "WAITING" ? waitingText.trim() : undefined,
      },
      actorEmail: user.email,
    });

    handleOpenChange(false);
  };

  const isWaitingValid =
    statusOperational !== "WAITING" || (waitingDate && waitingText.trim());

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle opportunité</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} id="create-card-form" className="space-y-4">
          <div>
            <Label htmlFor="card-title">Titre *</Label>
            <Input
              id="card-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Formation Agilité - Entreprise X"
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="card-column">Colonne</Label>
            <Select value={selectedColumnId || columnId} onValueChange={setSelectedColumnId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {columns.map((col) => (
                  <SelectItem key={col.id} value={col.id}>
                    {col.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="card-value">Valeur estimée (€)</Label>
            <Input
              id="card-value"
              type="number"
              min="0"
              step="0.01"
              value={estimatedValue}
              onChange={(e) => setEstimatedValue(e.target.value)}
              placeholder="0"
            />
          </div>

          <div>
            <Label htmlFor="status-operational">Statut opérationnel</Label>
            <Select
              value={statusOperational}
              onValueChange={(v) => setStatusOperational(v as StatusOperational)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAY">À traiter aujourd'hui</SelectItem>
                <SelectItem value="WAITING">En attente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {statusOperational === "WAITING" && (
            <>
              <div>
                <Label htmlFor="waiting-date">Date prochaine action *</Label>
                <Input
                  id="waiting-date"
                  type="date"
                  value={waitingDate}
                  onChange={(e) => setWaitingDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="waiting-text">Action prévue *</Label>
                <Input
                  id="waiting-text"
                  value={waitingText}
                  onChange={(e) => setWaitingText(e.target.value)}
                  placeholder="Ex: Relancer le client"
                />
              </div>
            </>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="submit"
            form="create-card-form"
            disabled={!title.trim() || !isWaitingValid || createCard.isPending}
          >
            {createCard.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateCardDialog;
