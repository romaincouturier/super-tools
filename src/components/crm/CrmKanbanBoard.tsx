import { useState, useEffect, useMemo } from "react";
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
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCrmBoard, useMoveCard, useCreateColumn, useCrmSettings } from "@/hooks/useCrmBoard";
import { useAuth } from "@/hooks/useAuth";
import { CrmCard } from "@/types/crm";
import CrmColumn from "./CrmColumn";
import CrmCardComponent from "./CrmCard";
import CardDetailDrawer from "./CardDetailDrawer";
import AddColumnDialog from "./AddColumnDialog";
import { isAfter, startOfDay } from "date-fns";

const CrmKanbanBoard = () => {
  const { user } = useAuth();
  const { data: boardData, isLoading } = useCrmBoard();
  const { data: crmSettings } = useCrmSettings();
  const moveCard = useMoveCard();
  const createColumn = useCreateColumn();

  const serviceTypeColors = crmSettings?.serviceTypeColors;

  const [activeCard, setActiveCard] = useState<CrmCard | null>(null);
  const [selectedCard, setSelectedCard] = useState<CrmCard | null>(null);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [localCards, setLocalCards] = useState<CrmCard[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Filter function to hide cards with scheduled action in the future
  const isCardVisible = (card: CrmCard): boolean => {
    if (!card.waiting_next_action_date) return true;
    const scheduledDate = startOfDay(new Date(card.waiting_next_action_date));
    const today = startOfDay(new Date());
    // Show card if scheduled date is today or in the past
    return !isAfter(scheduledDate, today);
  };

  // Sync local cards with server data, filtering out hidden cards
  useEffect(() => {
    if (boardData?.cards) {
      const visibleCards = boardData.cards.filter(isCardVisible);
      setLocalCards(visibleCards);
    }
  }, [boardData?.cards]);

  const handleDragStart = (event: DragStartEvent) => {
    const card = localCards.find((c) => c.id === event.active.id);
    if (card) setActiveCard(card);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeCardId = active.id as string;
    const overId = over.id as string;
    const activeCard = localCards.find((c) => c.id === activeCardId);
    if (!activeCard) return;

    // Check if over a column
    const overColumn = boardData?.columns.find((col) => col.id === overId);
    if (overColumn && activeCard.column_id !== overColumn.id) {
      setLocalCards((prev) =>
        prev.map((c) =>
          c.id === activeCardId ? { ...c, column_id: overColumn.id } : c
        )
      );
      return;
    }

    // Check if over another card
    const overCard = localCards.find((c) => c.id === overId);
    if (overCard && activeCard.column_id !== overCard.column_id) {
      setLocalCards((prev) =>
        prev.map((c) =>
          c.id === activeCardId ? { ...c, column_id: overCard.column_id } : c
        )
      );
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over || !user?.email) return;

    const activeCardId = active.id as string;
    const overId = over.id as string;
    const activeCard = localCards.find((c) => c.id === activeCardId);
    if (!activeCard) return;

    // Determine target column
    let targetColumnId = activeCard.column_id;
    const overColumn = boardData?.columns.find((col) => col.id === overId);
    const overCard = localCards.find((c) => c.id === overId);

    if (overColumn) {
      targetColumnId = overColumn.id;
    } else if (overCard) {
      targetColumnId = overCard.column_id;
    }

    // Calculate new position
    const columnCards = localCards.filter((c) => c.column_id === targetColumnId);
    const newIndex = overCard
      ? columnCards.findIndex((c) => c.id === overId)
      : columnCards.length;

    // Get old column for logging
    const oldColumnId = boardData?.cards.find((c) => c.id === activeCardId)?.column_id || targetColumnId;

    // Persist change
    moveCard.mutate({
      cardId: activeCardId,
      newColumnId: targetColumnId,
      newPosition: Math.max(0, newIndex),
      actorEmail: user.email,
      oldColumnId,
    });
  };

  const handleAddColumn = async (name: string) => {
    createColumn.mutate({ name });
    setShowAddColumn(false);
  };

  const handleCardClick = (card: CrmCard) => {
    setSelectedCard(card);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const columns = boardData?.columns || [];
  const tags = boardData?.tags || [];

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
            {columns.map((column) => {
              const columnCards = localCards
                .filter((c) => c.column_id === column.id)
                .sort((a, b) => a.position - b.position);

              return (
                <CrmColumn
                  key={column.id}
                  column={column}
                  cards={columnCards}
                  allColumns={columns}
                  onCardClick={handleCardClick}
                  serviceTypeColors={serviceTypeColors}
                />
              );
            })}
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
            <CrmCardComponent
              card={activeCard}
              isDragging
              serviceTypeColors={serviceTypeColors}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <AddColumnDialog
        open={showAddColumn}
        onOpenChange={setShowAddColumn}
        onAdd={handleAddColumn}
      />

      <CardDetailDrawer
        card={selectedCard}
        open={!!selectedCard}
        onOpenChange={(open) => !open && setSelectedCard(null)}
        allTags={tags}
        allColumns={columns}
      />
    </div>
  );
};

export default CrmKanbanBoard;
