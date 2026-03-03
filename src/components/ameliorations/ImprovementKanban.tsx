import { useMemo } from "react";
import type { Improvement, ImprovementStatus } from "@/hooks/useImprovements";
import { STATUS_CONFIG, KANBAN_COLUMNS } from "@/hooks/useImprovements";
import ImprovementCard from "./ImprovementCard";
import GenericKanbanBoard from "@/components/shared/kanban/GenericKanbanBoard";
import type { KanbanColumnDef, KanbanCardDef } from "@/types/kanban";

type ImprovementKanbanCard = Improvement & KanbanCardDef;
type ImprovementKanbanColumn = KanbanColumnDef;

interface ImprovementKanbanProps {
  grouped: Record<ImprovementStatus, Improvement[]>;
  onStatusChange: (id: string, status: ImprovementStatus) => void;
  onEdit: (improvement: Improvement) => void;
  onDelete: (id: string) => void;
  onClick: (improvement: Improvement) => void;
}

export default function ImprovementKanban({
  grouped,
  onStatusChange,
  onEdit,
  onDelete,
  onClick,
}: ImprovementKanbanProps) {
  const columns: ImprovementKanbanColumn[] = KANBAN_COLUMNS.map((status, idx) => ({
    id: status,
    name: STATUS_CONFIG[status].label,
    position: idx,
  }));

  const cards: ImprovementKanbanCard[] = useMemo(
    () =>
      KANBAN_COLUMNS.flatMap((status) =>
        (grouped[status] || []).map((imp, idx) => ({
          ...imp,
          columnId: status,
          position: idx,
        })),
      ),
    [grouped],
  );

  return (
    <GenericKanbanBoard<ImprovementKanbanCard, ImprovementKanbanColumn>
      columns={columns}
      cards={cards}
      config={{ cardSortable: false }}
      columnClassName="max-h-[calc(100vh-320px)]"
      renderCard={(card, isDragging) => (
        <ImprovementCard
          improvement={card}
          onStatusChange={isDragging ? () => {} : onStatusChange}
          onEdit={isDragging ? () => {} : onEdit}
          onDelete={isDragging ? () => {} : onDelete}
          onClick={isDragging ? () => {} : onClick}
          compact
        />
      )}
      renderColumnHeader={(col, colCards) => (
        <div className="flex items-center justify-between p-3 pb-0">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            {col.name}
            <span className="bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded-full">
              {colCards.length}
            </span>
          </h3>
        </div>
      )}
      renderEmptyColumn={() => (
        <div className="text-center py-6 text-muted-foreground text-xs">
          Aucune amélioration
        </div>
      )}
      onCardMove={({ card, targetColumnId }) => {
        onStatusChange(card.id, targetColumnId as ImprovementStatus);
      }}
      onCardClick={onClick}
    />
  );
}
