import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { MoreHorizontal, Plus, Pencil, Trash2, GripVertical } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import ContentCard from "./ContentCard";
import type { Column, Card, ContentTypeColors } from "./KanbanBoard";

interface KanbanColumnProps {
  column: Column;
  cards: Card[];
  typeColors: ContentTypeColors;
  onRename: (columnId: string, newName: string) => void;
  onDelete: (columnId: string) => void;
  onAddCard: () => void;
  onEditCard: (card: Card) => void;
  onViewCard: (card: Card) => void;
  onDeleteCard: (cardId: string) => void;
  onEmojiChange?: (cardId: string, emoji: string | null) => void;
}

const KanbanColumn = ({
  column,
  cards,
  typeColors,
  onRename,
  onDelete,
  onAddCard,
  onEditCard,
  onViewCard,
  onDeleteCard,
  onEmojiChange,
}: KanbanColumnProps) => {
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newName, setNewName] = useState(column.name);

  // Sortable for column reordering (using column- prefix)
  const {
    attributes: sortableAttributes,
    listeners: sortableListeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging: isColumnDragging,
  } = useSortable({ id: `column-${column.id}` });

  // Droppable for receiving cards
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: column.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleRename = () => {
    if (newName.trim()) {
      onRename(column.id, newName.trim());
      setShowRenameDialog(false);
    }
  };

  return (
    <>
      <div
        ref={(node) => {
          setSortableRef(node);
          setDroppableRef(node);
        }}
        style={style}
        className={`flex-shrink-0 w-72 bg-muted/50 rounded-lg p-3 flex flex-col max-h-[calc(100vh-280px)] ${
          isOver ? "ring-2 ring-primary" : ""
        } ${isColumnDragging ? "opacity-50" : ""}`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1">
            <span
              {...sortableAttributes}
              {...sortableListeners}
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-0.5"
            >
              <GripVertical className="h-4 w-4" />
            </span>
            <h3 className="font-semibold text-sm flex items-center gap-2">
              {column.name}
              <span className="bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded-full">
                {cards.length}
              </span>
            </h3>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onAddCard}
            >
              <Plus className="h-4 w-4" />
            </Button>

            {!column.is_system && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowRenameDialog(true)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Renommer
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => onDelete(column.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 min-h-[100px]">
          <SortableContext
            items={cards.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {cards.map((card) => (
              <ContentCard
                key={card.id}
                card={card}
                typeColors={typeColors}
                onView={() => onViewCard(card)}
                onEdit={() => onEditCard(card)}
                onDelete={() => onDeleteCard(card.id)}
                onEmojiChange={onEmojiChange}
              />
            ))}
          </SortableContext>

          {cards.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Aucune carte
            </div>
          )}
        </div>
      </div>

      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renommer la colonne</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="column-name">Nom</Label>
              <Input
                id="column-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleRename}>Renommer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default KanbanColumn;
