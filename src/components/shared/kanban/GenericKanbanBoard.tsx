import { useState, useCallback, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
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

const COLUMN_PREFIX = "column-";

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
  renderAfterColumns,
  onCardMove,
  onColumnReorder,
  onCardClick,
  columnClassName,
  boardClassName,
}: GenericKanbanBoardProps<TCard, TColumn>) {
  const {
    cardSortable = true,
    columnSortable = false,
    enableKeyboard = false,
    collisionDetection,
  } = config;
  const { sensors } = useKanbanDnd({ enableKeyboard });

  const [activeCard, setActiveCard] = useState<TCard | null>(null);
  const [activeColumn, setActiveColumn] = useState<TColumn | null>(null);
  // Track column override for card being dragged across columns
  const [dragColumnOverride, setDragColumnOverride] = useState<{
    cardId: string;
    columnId: string;
  } | null>(null);
  // Track column order during column drag
  const [columnOrder, setColumnOrder] = useState<TColumn[] | null>(null);

  const sortedColumns = useMemo(() => {
    const cols = columnOrder ?? columns;
    return [...cols].sort((a, b) => a.position - b.position);
  }, [columns, columnOrder]);

  const getCardsByColumn = useCallback(
    (columnId: string) => {
      let result = cards.filter((c) => {
        if (dragColumnOverride && c.id === dragColumnOverride.cardId) {
          return dragColumnOverride.columnId === columnId;
        }
        return c.columnId === columnId;
      });
      return result.sort((a, b) => a.position - b.position);
    },
    [cards, dragColumnOverride],
  );

  const handleDragStart = (event: DragStartEvent) => {
    const idStr = String(event.active.id);

    if (columnSortable && idStr.startsWith(COLUMN_PREFIX)) {
      const colId = idStr.slice(COLUMN_PREFIX.length);
      const col = columns.find((c) => c.id === colId);
      if (col) setActiveColumn(col);
      return;
    }

    const card = cards.find((c) => c.id === event.active.id);
    if (card) setActiveCard(card);
  };

  const resolveColumnId = useCallback(
    (id: string): string | undefined => {
      if (columns.find((col) => col.id === id)) return id;
      if (id.startsWith(COLUMN_PREFIX)) {
        const stripped = id.slice(COLUMN_PREFIX.length);
        if (columns.find((col) => col.id === stripped)) return stripped;
      }
      return undefined;
    },
    [columns],
  );

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    // Skip column drags
    if (String(active.id).startsWith(COLUMN_PREFIX)) return;

    const activeCardId = active.id as string;
    const overId = over.id as string;

    const card = cards.find((c) => c.id === activeCardId);
    if (!card) return;

    const currentColumnId = dragColumnOverride?.cardId === activeCardId
      ? dragColumnOverride.columnId
      : card.columnId;

    // Over a column directly
    const overColumnId = resolveColumnId(overId);
    if (overColumnId && currentColumnId !== overColumnId) {
      setDragColumnOverride({ cardId: activeCardId, columnId: overColumnId });
      return;
    }

    // Over another card
    const overCard = cards.find((c) => c.id === overId);
    if (overCard) {
      const overCardColumnId = dragColumnOverride?.cardId === overId
        ? dragColumnOverride.columnId
        : overCard.columnId;
      if (currentColumnId !== overCardColumnId) {
        setDragColumnOverride({ cardId: activeCardId, columnId: overCardColumnId });
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveCard(null);
    setActiveColumn(null);
    setDragColumnOverride(null);
    setColumnOrder(null);

    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    // --- Column reorder ---
    if (
      columnSortable &&
      activeIdStr.startsWith(COLUMN_PREFIX) &&
      overIdStr.startsWith(COLUMN_PREFIX)
    ) {
      const activeColId = activeIdStr.slice(COLUMN_PREFIX.length);
      const overColId = overIdStr.slice(COLUMN_PREFIX.length);
      if (activeColId === overColId) return;

      const sorted = [...columns].sort((a, b) => a.position - b.position);
      const oldIndex = sorted.findIndex((c) => c.id === activeColId);
      const newIndex = sorted.findIndex((c) => c.id === overColId);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(sorted, oldIndex, newIndex);
      await onColumnReorder?.(reordered.map((c) => c.id));
      return;
    }

    // --- Card move ---
    const card = cards.find((c) => c.id === active.id);
    if (!card) return;

    let targetColumnId: string;
    const overCard = cards.find((c) => c.id === over.id);
    if (overCard) {
      targetColumnId = overCard.columnId;
    } else {
      const resolvedColId = resolveColumnId(over.id as string);
      if (resolvedColId) {
        targetColumnId = resolvedColId;
      } else {
        return;
      }
    }

    const targetCards = getCardsByColumn(targetColumnId);
    let newPosition: number;
    if (overCard) {
      newPosition = targetCards.findIndex((c) => c.id === overCard.id);
      if (newPosition === -1) newPosition = targetCards.length;
    } else {
      newPosition = targetCards.length;
    }

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

  const columnSortableItems = columnSortable
    ? sortedColumns.map((c) => `${COLUMN_PREFIX}${c.id}`)
    : [];

  const columnsContent = sortedColumns.map((column) => {
    const columnCards = getCardsByColumn(column.id);
    return (
      <GenericKanbanColumn
        key={column.id}
        column={column}
        cards={columnCards}
        sortable={cardSortable}
        columnSortableId={columnSortable ? `${COLUMN_PREFIX}${column.id}` : undefined}
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
  });

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection ?? closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className={cn("flex gap-4 overflow-x-auto pb-4 h-full", boardClassName)}>
        {columnSortable ? (
          <SortableContext items={columnSortableItems} strategy={horizontalListSortingStrategy}>
            {columnsContent}
          </SortableContext>
        ) : (
          columnsContent
        )}
        {renderAfterColumns?.()}
      </div>

      <DragOverlay>
        {activeCard ? (
          <div className="opacity-80 rotate-2">
            {renderCard(activeCard, true)}
          </div>
        ) : activeColumn ? (
          <div className="flex-shrink-0 w-72 bg-muted/50 rounded-lg p-3 opacity-80 shadow-lg rotate-1">
            <h3 className="font-semibold text-sm">{activeColumn.name}</h3>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
