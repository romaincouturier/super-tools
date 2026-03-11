import { useState, useCallback, useMemo, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  rectIntersection,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type CollisionDetection,
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

/**
 * Collision detection optimised for multi-container kanban boards.
 * Uses pointerWithin for reliable container detection (handles empty columns),
 * then closestCenter among matched droppables for card-level precision.
 */
const kanbanCollision: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    const ids = new Set(pointerCollisions.map((c) => c.id));
    const filtered = args.droppableContainers.filter((c) => ids.has(c.id));
    if (filtered.length > 0) {
      const refined = closestCenter({ ...args, droppableContainers: filtered });
      if (refined.length > 0) return refined;
    }
    return pointerCollisions;
  }
  const rectCollisions = rectIntersection(args);
  if (rectCollisions.length > 0) return rectCollisions;
  return closestCenter(args);
};

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

  // Optimistic local order: columnId → ordered card IDs.
  // Non-null only while a card drag is in progress.
  const [itemsMap, setItemsMap] = useState<Record<string, string[]> | null>(null);

  // Track column order during column drag
  const [columnOrder, setColumnOrder] = useState<TColumn[] | null>(null);

  // Keep a ref to cards so callbacks always see the latest value
  const cardsRef = useRef(cards);
  cardsRef.current = cards;

  const cardById = useMemo(() => {
    const map = new Map<string, TCard>();
    for (const c of cards) map.set(c.id, c);
    return map;
  }, [cards]);

  const sortedColumns = useMemo(() => {
    const cols = columnOrder ?? columns;
    return [...cols].sort((a, b) => a.position - b.position);
  }, [columns, columnOrder]);

  /** Build the initial items map from current cards/columns. */
  const buildItemsMap = useCallback((): Record<string, string[]> => {
    const map: Record<string, string[]> = {};
    for (const col of columns) {
      map[col.id] = cards
        .filter((c) => c.columnId === col.id)
        .sort((a, b) => a.position - b.position)
        .map((c) => c.id);
    }
    return map;
  }, [cards, columns]);

  /** Get ordered cards for a column, using optimistic local state when dragging. */
  const getCardsByColumn = useCallback(
    (columnId: string): TCard[] => {
      if (itemsMap) {
        const ids = itemsMap[columnId] || [];
        return ids.map((id) => cardById.get(id)).filter(Boolean) as TCard[];
      }
      return cards
        .filter((c) => c.columnId === columnId)
        .sort((a, b) => a.position - b.position);
    },
    [cards, cardById, itemsMap],
  );

  /** Find which column contains a card ID in the current items map. */
  const findColumnForCard = (map: Record<string, string[]>, cardId: string): string | undefined => {
    for (const [colId, ids] of Object.entries(map)) {
      if (ids.includes(cardId)) return colId;
    }
    return undefined;
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

  // ---- Drag handlers ----

  const handleDragStart = (event: DragStartEvent) => {
    const idStr = String(event.active.id);

    if (columnSortable && idStr.startsWith(COLUMN_PREFIX)) {
      const colId = idStr.slice(COLUMN_PREFIX.length);
      const col = columns.find((c) => c.id === colId);
      if (col) setActiveColumn(col);
      return;
    }

    const card = cards.find((c) => c.id === event.active.id);
    if (card) {
      setActiveCard(card);
      setItemsMap(buildItemsMap());
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !itemsMap) return;
    if (String(active.id).startsWith(COLUMN_PREFIX)) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeColId = findColumnForCard(itemsMap, activeId);
    if (!activeColId) return;

    // Determine target column
    let overColId: string | undefined;
    const overCard = cardById.get(overId);
    if (overCard) {
      overColId = findColumnForCard(itemsMap, overId);
    } else {
      overColId = resolveColumnId(overId);
    }
    if (!overColId) return;

    setItemsMap((prev) => {
      if (!prev) return prev;
      const next = { ...prev };

      if (activeColId !== overColId) {
        // Cross-column move: remove from source, insert in target
        const sourceIds = [...(next[activeColId] || [])];
        const targetIds = [...(next[overColId!] || [])];
        const fromIndex = sourceIds.indexOf(activeId);
        if (fromIndex === -1) return prev;

        sourceIds.splice(fromIndex, 1);

        // Insert at the position of the over card, or at the end
        let toIndex = targetIds.length;
        if (overCard) {
          const overIndex = targetIds.indexOf(overId);
          if (overIndex !== -1) toIndex = overIndex;
        }
        targetIds.splice(toIndex, 0, activeId);

        next[activeColId] = sourceIds;
        next[overColId!] = targetIds;
      } else {
        // Same column: reorder
        const ids = [...(next[activeColId] || [])];
        const fromIndex = ids.indexOf(activeId);
        let toIndex = overCard ? ids.indexOf(overId) : ids.length - 1;
        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return prev;

        next[activeColId] = arrayMove(ids, fromIndex, toIndex);
      }
      return next;
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const finalMap = itemsMap;

    setActiveCard(null);
    setActiveColumn(null);
    setItemsMap(null);
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
    if (!card || !finalMap) return;

    // Find final column and position from the optimistic map
    const targetColumnId = findColumnForCard(finalMap, card.id);
    if (!targetColumnId) return;

    const newPosition = (finalMap[targetColumnId] || []).indexOf(card.id);
    if (newPosition === -1) return;

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
      collisionDetection={collisionDetection ?? kanbanCollision}
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
