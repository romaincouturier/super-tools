import { useState, useCallback } from "react";
import {
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

interface KanbanItem {
  id: string;
  [key: string]: unknown;
}

interface UseKanbanDndOptions<T extends KanbanItem> {
  items: T[];
  getItemColumnId: (item: T) => string;
  onMoveItem: (params: {
    itemId: string;
    targetColumnId: string;
    newIndex: number;
    item: T;
  }) => void | Promise<void>;
  onDragOver?: (params: {
    activeItem: T;
    overItemId: string;
    overColumnId: string | null;
  }) => void;
  columns?: Array<{ id: string }>;
  enableKeyboard?: boolean;
  activationDistance?: number;
}

export function useKanbanDnd<T extends KanbanItem>({
  items,
  getItemColumnId,
  onMoveItem,
  onDragOver,
  columns,
  enableKeyboard = true,
  activationDistance = 8,
}: UseKanbanDndOptions<T>) {
  const [activeItem, setActiveItem] = useState<T | null>(null);

  const sensorList = [
    useSensor(PointerSensor, {
      activationConstraint: { distance: activationDistance },
    }),
    ...(enableKeyboard
      ? [
          useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
          }),
        ]
      : []),
  ];
  const sensors = useSensors(...sensorList);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const item = items.find((i) => i.id === event.active.id);
      if (item) setActiveItem(item);
    },
    [items]
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      if (!onDragOver) return;
      const { active, over } = event;
      if (!over) return;

      const activeItemFound = items.find((i) => i.id === active.id);
      if (!activeItemFound) return;

      const overId = over.id as string;
      const overColumn = columns?.find((col) => col.id === overId);
      const overItem = items.find((i) => i.id === overId);

      onDragOver({
        activeItem: activeItemFound,
        overItemId: overId,
        overColumnId: overColumn?.id || (overItem ? getItemColumnId(overItem) : null),
      });
    },
    [items, columns, onDragOver, getItemColumnId]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveItem(null);
      if (!over) return;

      const itemId = active.id as string;
      const overId = over.id as string;
      const draggedItem = items.find((i) => i.id === itemId);
      if (!draggedItem) return;

      // Determine target column
      let targetColumnId = getItemColumnId(draggedItem);
      const overColumn = columns?.find((col) => col.id === overId);
      const overItem = items.find((i) => i.id === overId);

      if (overColumn) {
        targetColumnId = overColumn.id;
      } else if (overItem) {
        targetColumnId = getItemColumnId(overItem);
      }

      // Calculate position
      const columnItems = items.filter((i) => getItemColumnId(i) === targetColumnId);
      const newIndex = overItem
        ? columnItems.findIndex((i) => i.id === overId)
        : columnItems.length;

      await onMoveItem({
        itemId,
        targetColumnId,
        newIndex: Math.max(0, newIndex),
        item: draggedItem,
      });
    },
    [items, columns, getItemColumnId, onMoveItem]
  );

  return {
    sensors,
    activeItem,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
}
