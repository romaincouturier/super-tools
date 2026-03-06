import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KanbanColumnDef, KanbanCardDef } from "@/types/kanban";

interface GenericKanbanColumnProps<
  TCard extends KanbanCardDef,
  TColumn extends KanbanColumnDef,
> {
  column: TColumn;
  cards: TCard[];
  sortable: boolean;
  columnSortableId?: string;
  renderCard: (card: TCard) => ReactNode;
  renderHeader?: (column: TColumn, cards: TCard[], dragHandle?: ReactNode) => ReactNode;
  renderEmpty?: (column: TColumn) => ReactNode;
  className?: string;
}

export default function GenericKanbanColumn<
  TCard extends KanbanCardDef,
  TColumn extends KanbanColumnDef,
>({
  column,
  cards,
  sortable,
  columnSortableId,
  renderCard,
  renderHeader,
  renderEmpty,
  className,
}: GenericKanbanColumnProps<TCard, TColumn>) {
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: column.id });

  const {
    attributes: sortableAttributes,
    listeners: sortableListeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging: isColumnDragging,
  } = useSortable({
    id: columnSortableId ?? `__col_disabled_${column.id}`,
    disabled: !columnSortableId,
  });

  const style = columnSortableId
    ? { transform: CSS.Transform.toString(transform), transition }
    : undefined;

  const dragHandle = columnSortableId ? (
    <span
      {...sortableAttributes}
      {...sortableListeners}
      className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-0.5"
    >
      <GripVertical className="h-4 w-4" />
    </span>
  ) : null;

  return (
    <div
      ref={(node) => {
        if (columnSortableId) setSortableRef(node);
        setDroppableRef(node);
      }}
      style={style}
      className={cn(
        "flex-shrink-0 w-72 bg-muted/30 rounded-lg flex flex-col",
        isOver && "ring-2 ring-primary",
        isColumnDragging && "opacity-50",
        className,
      )}
    >
      {renderHeader?.(column, cards, dragHandle)}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-[80px] p-2 transition-colors">
        {sortable ? (
          <SortableContext
            items={cards.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {cards.map((card) => renderCard(card))}
          </SortableContext>
        ) : (
          cards.map((card) => renderCard(card))
        )}

        {cards.length === 0 &&
          (renderEmpty ? (
            renderEmpty(column)
          ) : (
            <div className="text-center py-6 text-muted-foreground text-xs">
              Aucun élément
            </div>
          ))}
      </div>
    </div>
  );
}
