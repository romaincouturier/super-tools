import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BreakEvenSaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEditing: boolean;
  name: string;
  notes: string;
  onNameChange: (v: string) => void;
  onNotesChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
}

export default function BreakEvenSaveDialog({
  open,
  onOpenChange,
  isEditing,
  name,
  notes,
  onNameChange,
  onNotesChange,
  onSave,
  saving,
}: BreakEvenSaveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Renommer le scénario" : "Sauvegarder le scénario"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Met à jour le nom et les notes." : "Donne-lui un nom pour le retrouver plus tard."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="scenario-name">Nom</Label>
            <Input
              id="scenario-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Ex : Objectif 2026 — pessimiste"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="scenario-notes">Notes</Label>
            <Textarea
              id="scenario-notes"
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Hypothèses retenues, contexte..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={onSave} disabled={saving || !name.trim()}>
            {saving ? <Spinner className="mr-2" /> : null}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
