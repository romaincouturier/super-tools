import React, { useState } from "react";
import { MoreVertical, Pencil, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CrmColumn as CrmColumnType } from "@/types/crm";
import { useUpdateColumn, useArchiveColumn } from "@/hooks/useCrmBoard";

interface CardWithEstimatedValue {
  estimated_value?: number | null;
}

interface CrmColumnHeaderProps {
  column: CrmColumnType;
  cards: CardWithEstimatedValue[];
}

const CrmColumnHeader = ({ column, cards }: CrmColumnHeaderProps) => {
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newName, setNewName] = useState(column.name);

  const updateColumn = useUpdateColumn();
  const archiveColumn = useArchiveColumn();

  const handleRename = () => {
    if (newName.trim() && newName !== column.name) {
      updateColumn.mutate({ id: column.id, name: newName.trim() });
    }
    setShowRenameDialog(false);
  };

  const handleArchive = () => {
    if (confirm(`Archiver la colonne "${column.name}" ? Les cartes seront conservées mais la colonne ne sera plus visible.`)) {
      archiveColumn.mutate(column.id);
    }
  };

  const totalValue = cards.reduce((sum, card) => sum + (card.estimated_value || 0), 0);

  return (
    <>
      <div className="p-3 border-b">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">{column.name}</h3>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {cards.length}
            </span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowRenameDialog(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Renommer
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleArchive}>
                <Archive className="h-4 w-4 mr-2" />
                Archiver
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {totalValue > 0 && (
          <div className="text-xs text-muted-foreground">
            Total: {totalValue.toLocaleString("fr-FR")} €
          </div>
        )}
      </div>

      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renommer la colonne</DialogTitle>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nom de la colonne"
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleRename}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default React.memo(CrmColumnHeader);
