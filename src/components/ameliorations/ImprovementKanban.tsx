import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useState } from "react";
import type { Improvement, ImprovementStatus } from "@/hooks/useImprovements";
import { STATUS_CONFIG, KANBAN_COLUMNS } from "@/hooks/useImprovements";
import ImprovementCard from "./ImprovementCard";

interface ImprovementKanbanProps {
  grouped: Record<ImprovementStatus, Improvement[]>;
  onStatusChange: (id: string, status: ImprovementStatus) => void;
  onEdit: (improvement: Improvement) => void;
  onDelete: (id: string) => void;
  onClick: (improvement: Improvement) => void;
}

function KanbanColumn({
  status,
  items,
  onStatusChange,
  onEdit,
  onDelete,
  onClick,
}: {
  status: ImprovementStatus;
  items: Improvement[];
  onStatusChange: (id: string, status: ImprovementStatus) => void;
  onEdit: (improvement: Improvement) => void;
  onDelete: (id: string) => void;
  onClick: (improvement: Improvement) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const cfg = STATUS_CONFIG[status];

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-72 bg-muted/50 rounded-lg p-3 flex flex-col max-h-[calc(100vh-320px)] ${
        isOver ? "ring-2 ring-primary" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          {cfg.label}
          <span className="bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded-full">
            {items.length}
          </span>
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 min-h-[80px]">
        {items.map((imp) => (
          <ImprovementCard
            key={imp.id}
            improvement={imp}
            onStatusChange={onStatusChange}
            onEdit={onEdit}
            onDelete={onDelete}
            onClick={onClick}
            compact
          />
        ))}
        {items.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-xs">
            Aucune amélioration
          </div>
        )}
      </div>
    </div>
  );
}

export default function ImprovementKanban({
  grouped,
  onStatusChange,
  onEdit,
  onDelete,
  onClick,
}: ImprovementKanbanProps) {
  const [activeCard, setActiveCard] = useState<Improvement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    for (const items of Object.values(grouped)) {
      const found = items.find((i) => i.id === id);
      if (found) {
        setActiveCard(found);
        break;
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    const cardId = active.id as string;
    const targetStatus = over.id as ImprovementStatus;

    // Only process if dropped on a column (not another card)
    if (!KANBAN_COLUMNS.includes(targetStatus)) return;

    // Find current status
    for (const [status, items] of Object.entries(grouped)) {
      if (items.some((i) => i.id === cardId) && status !== targetStatus) {
        onStatusChange(cardId, targetStatus);
        break;
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {KANBAN_COLUMNS.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            items={grouped[status]}
            onStatusChange={onStatusChange}
            onEdit={onEdit}
            onDelete={onDelete}
            onClick={onClick}
          />
        ))}
      </div>
      <DragOverlay>
        {activeCard && (
          <div className="opacity-80 rotate-2">
            <ImprovementCard
              improvement={activeCard}
              onStatusChange={() => {}}
              onEdit={() => {}}
              onDelete={() => {}}
              onClick={() => {}}
              compact
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
