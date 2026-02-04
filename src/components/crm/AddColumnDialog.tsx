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

interface AddColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (name: string) => void;
}

const AddColumnDialog = ({ open, onOpenChange, onAdd }: AddColumnDialogProps) => {
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onAdd(name.trim());
      setName("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle colonne</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} id="add-column-form">
          <div className="space-y-4">
            <div>
              <Label htmlFor="column-name">Nom de la colonne</Label>
              <Input
                id="column-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Qualification"
                autoFocus
              />
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" form="add-column-form" disabled={!name.trim()}>
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddColumnDialog;
