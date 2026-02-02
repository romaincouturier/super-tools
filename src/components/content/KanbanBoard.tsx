import { useState, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import KanbanColumn from "./KanbanColumn";
import ContentCard from "./ContentCard";
import ContentCardDialog from "./ContentCardDialog";
import AddColumnDialog from "./AddColumnDialog";

export interface Column {
  id: string;
  name: string;
  display_order: number;
  is_system: boolean;
}

export interface Card {
  id: string;
  column_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  tags: string[];
  display_order: number;
}

const KanbanBoard = () => {
  const [columns, setColumns] = useState<Column[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [newCardColumnId, setNewCardColumnId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [columnsRes, cardsRes] = await Promise.all([
        supabase
          .from("content_columns")
          .select("*")
          .order("display_order"),
        supabase
          .from("content_cards")
          .select("*")
          .order("display_order"),
      ]);

      if (columnsRes.error) throw columnsRes.error;
      if (cardsRes.error) throw cardsRes.error;

      setColumns(columnsRes.data || []);
      setCards(
        (cardsRes.data || []).map((c) => ({
          id: c.id,
          column_id: c.column_id,
          title: c.title,
          description: c.description,
          image_url: c.image_url,
          display_order: c.display_order,
          tags: Array.isArray(c.tags) ? (c.tags as string[]) : [],
        }))
      );
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const card = cards.find((c) => c.id === active.id);
    if (card) {
      setActiveCard(card);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeCardId = active.id as string;
    const overId = over.id as string;

    const activeCard = cards.find((c) => c.id === activeCardId);
    if (!activeCard) return;

    // Check if we're over a column
    const overColumn = columns.find((col) => col.id === overId);
    if (overColumn) {
      // Moving to an empty column or the column itself
      if (activeCard.column_id !== overColumn.id) {
        setCards((prev) =>
          prev.map((c) =>
            c.id === activeCardId ? { ...c, column_id: overColumn.id } : c
          )
        );
      }
      return;
    }

    // Check if we're over another card
    const overCard = cards.find((c) => c.id === overId);
    if (overCard && activeCard.column_id !== overCard.column_id) {
      setCards((prev) =>
        prev.map((c) =>
          c.id === activeCardId ? { ...c, column_id: overCard.column_id } : c
        )
      );
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const activeCardId = active.id as string;
    const overId = over.id as string;

    const activeCard = cards.find((c) => c.id === activeCardId);
    if (!activeCard) return;

    // Find the target column
    let targetColumnId = activeCard.column_id;
    const overColumn = columns.find((col) => col.id === overId);
    const overCard = cards.find((c) => c.id === overId);

    if (overColumn) {
      targetColumnId = overColumn.id;
    } else if (overCard) {
      targetColumnId = overCard.column_id;
    }

    // Get cards in the target column
    const columnCards = cards.filter((c) => c.column_id === targetColumnId);
    const oldIndex = columnCards.findIndex((c) => c.id === activeCardId);
    const newIndex = overCard
      ? columnCards.findIndex((c) => c.id === overId)
      : columnCards.length;

    if (oldIndex !== -1 && oldIndex !== newIndex) {
      const newOrder = arrayMove(columnCards, oldIndex, newIndex);
      const updatedCards = cards.map((c) => {
        const orderIndex = newOrder.findIndex((nc) => nc.id === c.id);
        if (orderIndex !== -1) {
          return { ...c, display_order: orderIndex };
        }
        return c;
      });
      setCards(updatedCards);
    }

    // Update in database
    try {
      await supabase
        .from("content_cards")
        .update({
          column_id: targetColumnId,
          display_order: newIndex >= 0 ? newIndex : 0,
        })
        .eq("id", activeCardId);
    } catch (error) {
      console.error("Error updating card position:", error);
      toast.error("Erreur lors du déplacement de la carte");
      fetchData();
    }
  };

  const handleAddColumn = async (name: string) => {
    try {
      const archiveColumn = columns.find((c) => c.name === "Archive");
      const newOrder = archiveColumn
        ? archiveColumn.display_order
        : columns.length;

      // Shift archive column
      if (archiveColumn) {
        await supabase
          .from("content_columns")
          .update({ display_order: archiveColumn.display_order + 1 })
          .eq("id", archiveColumn.id);
      }

      const { data, error } = await supabase
        .from("content_columns")
        .insert({ name, display_order: newOrder })
        .select()
        .single();

      if (error) throw error;

      toast.success("Colonne ajoutée");
      fetchData();
    } catch (error) {
      console.error("Error adding column:", error);
      toast.error("Erreur lors de l'ajout de la colonne");
    }
    setShowAddColumn(false);
  };

  const handleRenameColumn = async (columnId: string, newName: string) => {
    try {
      const { error } = await supabase
        .from("content_columns")
        .update({ name: newName })
        .eq("id", columnId);

      if (error) throw error;

      setColumns((prev) =>
        prev.map((c) => (c.id === columnId ? { ...c, name: newName } : c))
      );
      toast.success("Colonne renommée");
    } catch (error) {
      console.error("Error renaming column:", error);
      toast.error("Erreur lors du renommage");
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    try {
      const { error } = await supabase
        .from("content_columns")
        .delete()
        .eq("id", columnId);

      if (error) throw error;

      setColumns((prev) => prev.filter((c) => c.id !== columnId));
      setCards((prev) => prev.filter((c) => c.column_id !== columnId));
      toast.success("Colonne supprimée");
    } catch (error) {
      console.error("Error deleting column:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleSaveCard = async (cardData: Partial<Card>) => {
    try {
      if (editingCard) {
        const { error } = await supabase
          .from("content_cards")
          .update({
            title: cardData.title,
            description: cardData.description,
            image_url: cardData.image_url,
            tags: cardData.tags,
          })
          .eq("id", editingCard.id);

        if (error) throw error;
        toast.success("Carte mise à jour");
      } else if (newCardColumnId) {
        const columnCards = cards.filter((c) => c.column_id === newCardColumnId);
        const { error } = await supabase.from("content_cards").insert({
          column_id: newCardColumnId,
          title: cardData.title || "Nouvelle carte",
          description: cardData.description,
          image_url: cardData.image_url,
          tags: cardData.tags || [],
          display_order: columnCards.length,
        });

        if (error) throw error;
        toast.success("Carte créée");
      }
      fetchData();
    } catch (error) {
      console.error("Error saving card:", error);
      toast.error("Erreur lors de la sauvegarde");
    }
    setEditingCard(null);
    setNewCardColumnId(null);
  };

  const handleDeleteCard = async (cardId: string) => {
    try {
      const { error } = await supabase
        .from("content_cards")
        .delete()
        .eq("id", cardId);

      if (error) throw error;

      setCards((prev) => prev.filter((c) => c.id !== cardId));
      toast.success("Carte supprimée");
    } catch (error) {
      console.error("Error deleting card:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 h-full">
          <SortableContext
            items={columns.map((c) => c.id)}
            strategy={horizontalListSortingStrategy}
          >
            {columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                cards={cards.filter((c) => c.column_id === column.id)}
                onRename={handleRenameColumn}
                onDelete={handleDeleteColumn}
                onAddCard={() => setNewCardColumnId(column.id)}
                onEditCard={setEditingCard}
                onDeleteCard={handleDeleteCard}
              />
            ))}
          </SortableContext>

          <div className="flex-shrink-0 w-72">
            <Button
              variant="outline"
              className="w-full h-12 border-dashed"
              onClick={() => setShowAddColumn(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Ajouter une colonne
            </Button>
          </div>
        </div>

        <DragOverlay>
          {activeCard ? (
            <ContentCard card={activeCard} isDragging />
          ) : null}
        </DragOverlay>
      </DndContext>

      <AddColumnDialog
        open={showAddColumn}
        onOpenChange={setShowAddColumn}
        onAdd={handleAddColumn}
      />

      <ContentCardDialog
        open={!!editingCard || !!newCardColumnId}
        onOpenChange={(open) => {
          if (!open) {
            setEditingCard(null);
            setNewCardColumnId(null);
          }
        }}
        card={editingCard}
        onSave={handleSaveCard}
      />
    </div>
  );
};

export default KanbanBoard;
