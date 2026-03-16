import React, { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
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
import { CrmColumn as CrmColumnType, CrmCard } from "@/types/crm";
import { useUpdateColumn, useArchiveColumn } from "@/hooks/useCrmBoard";
import CrmCardComponent from "./CrmCard";

interface ServiceTypeColors {
  formation: string;
  mission: string;
  default: string;
}

interface CrmColumnProps {
  column: CrmColumnType;
  cards: CrmCard[];
  onCardClick: (card: CrmCard) => void;
  serviceTypeColors?: ServiceTypeColors;
}

const CrmColumn = ({ column, cards, onCardClick, serviceTypeColors }: CrmColumnProps) => {
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newName, setNewName] = useState(column.name);

  const updateColumn = useUpdateColumn();
  const archiveColumn = useArchiveColumn();

  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

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

  // Calculate total value in column
  const totalValue = cards.reduce((sum, card) => sum + (card.estimated_value || 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-72 bg-muted/50 rounded-lg p-3 flex flex-col max-h-[calc(100vh-200px)] ${
        isOver ? "ring-2 ring-primary" : ""
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-3">
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

      {/* Total Value */}
      {totalValue > 0 && (
        <div className="text-xs text-muted-foreground mb-2">
          Total: {totalValue.toLocaleString("fr-FR")} €
        </div>
      )}

      {/* Cards */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-[50px]">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <CrmCardComponent
              key={card.id}
              card={card}
              onClick={() => onCardClick(card)}
              serviceTypeColors={serviceTypeColors}
            />
          ))}
        </SortableContext>
      </div>

      {/* Rename Dialog */}
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
    </div>
  );
};

export default React.memo(CrmColumn);
