import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Loader2 } from "lucide-react";
import { useKanbanDnd } from "@/hooks/useKanbanDnd";
import GenericKanbanColumn from "./GenericKanbanColumn";
import type {
  KanbanCardDef,
  KanbanColumnDef,
  KanbanDropResult,
  GenericKanbanBoardProps,
} from "@/types/kanban";
import { cn } from "@/lib/utils";

export default function GenericKanbanBoard<
  TCard extends KanbanCardDef,
  TColumn extends KanbanColumnDef,
>({
  columns,
  cards,
  loading,
  config = {},
  renderCard,
  renderColumnHeader,
  renderEmptyColumn,
  onCardMove,
  onCardClick,
  columnClassName,
  boardClassName,
}: GenericKanbanBoardProps<TCard, TColumn>) {
  const { cardSortable = true, enableKeyboard = false, collisionDetection } = config;
  const { sensors } = useKanbanDnd({ enableKeyboard });

  const [activeCard, setActiveCard] = useState<TCard | null>(null);

  const getCardsByColumn = useCallback(
    (columnId: string) =>
      cards
        .filter((c) => c.columnId === columnId)
        .sort((a, b) => a.position - b.position),
    [cards],
  );

  const handleDragStart = (event: DragStartEvent) => {
    const card = cards.find((c) => c.id === event.active.id);
    if (card) setActiveCard(card);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    const card = cards.find((c) => c.id === active.id);
    if (!card) return;

    // Determine target column
    let targetColumnId: string;
    const overCard = cards.find((c) => c.id === over.id);
    if (overCard) {
      targetColumnId = overCard.columnId;
    } else if (columns.some((col) => col.id === over.id)) {
      targetColumnId = over.id as string;
    } else {
      return;
    }

    // Calculate position
    const targetCards = getCardsByColumn(targetColumnId);
    let newPosition: number;
    if (overCard) {
      newPosition = targetCards.findIndex((c) => c.id === overCard.id);
      if (newPosition === -1) newPosition = targetCards.length;
    } else {
      newPosition = targetCards.length;
    }

    // Skip if nothing changed
    if (card.columnId === targetColumnId && card.position === newPosition) return;

    const dropResult: KanbanDropResult<TCard> = {
      card,
      sourceColumnId: card.columnId,
      targetColumnId,
      newPosition,
    };

    await onCardMove(dropResult);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sortedColumns = [...columns].sort((a, b) => a.position - b.position);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection ?? closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={cn("flex gap-4 overflow-x-auto pb-4 h-full", boardClassName)}>
        {sortedColumns.map((column) => {
          const columnCards = getCardsByColumn(column.id);
          return (
            <GenericKanbanColumn
              key={column.id}
              column={column}
              cards={columnCards}
              sortable={cardSortable}
              renderCard={(card) => (
                <div
                  key={card.id}
                  onClick={() => onCardClick?.(card)}
                  className="cursor-pointer"
                >
                  {renderCard(card, false)}
                </div>
              )}
              renderHeader={renderColumnHeader}
              renderEmpty={renderEmptyColumn}
              className={columnClassName}
            />
          );
        })}
      </div>

      <DragOverlay>
        {activeCard ? (
          <div className="opacity-80 rotate-2">
            {renderCard(activeCard, true)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
