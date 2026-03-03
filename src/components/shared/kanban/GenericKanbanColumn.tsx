import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import type { KanbanColumnDef, KanbanCardDef } from "@/types/kanban";

interface GenericKanbanColumnProps<
  TCard extends KanbanCardDef,
  TColumn extends KanbanColumnDef,
> {
  column: TColumn;
  cards: TCard[];
  sortable: boolean;
  renderCard: (card: TCard) => ReactNode;
  renderHeader?: (column: TColumn, cards: TCard[]) => ReactNode;
  renderFooter?: (column: TColumn) => ReactNode;
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
  renderCard,
  renderHeader,
  renderFooter,
  renderEmpty,
  className,
}: GenericKanbanColumnProps<TCard, TColumn>) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  const content = (
    <>
      {renderHeader?.(column, cards)}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 overflow-y-auto space-y-2 min-h-[80px] p-2 transition-colors",
          isOver && "bg-primary/5 ring-2 ring-primary rounded",
        )}
      >
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
      {renderFooter?.(column)}
    </>
  );

  return (
    <div
      className={cn(
        "flex-shrink-0 w-72 bg-muted/30 rounded-lg flex flex-col",
        className,
      )}
    >
      {content}
    </div>
  );
}
