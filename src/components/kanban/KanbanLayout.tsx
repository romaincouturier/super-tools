import { ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  CollisionDetection,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Loader2 } from "lucide-react";

interface KanbanLayoutProps {
  /** DnD sensors from useKanbanDnd */
  sensors: ReturnType<typeof import("@dnd-kit/core").useSensors>;
  /** Drag event handlers */
  onDragStart: (event: import("@dnd-kit/core").DragStartEvent) => void;
  onDragEnd: (event: import("@dnd-kit/core").DragEndEvent) => void;
  onDragOver?: (event: import("@dnd-kit/core").DragOverEvent) => void;
  /** Collision detection strategy */
  collisionDetection?: CollisionDetection;
  /** Column IDs for sortable context (if columns are reorderable) */
  columnIds?: string[];
  /** Whether columns are sortable/reorderable */
  sortableColumns?: boolean;
  /** Content to render in the drag overlay */
  dragOverlay?: ReactNode;
  /** The column components */
  children: ReactNode;
  /** Loading state */
  isLoading?: boolean;
  /** Error message */
  error?: string;
  /** Additional class name for the columns container */
  className?: string;
}

const KanbanLayout = ({
  sensors,
  onDragStart,
  onDragEnd,
  onDragOver,
  collisionDetection = closestCorners,
  columnIds,
  sortableColumns = false,
  dragOverlay,
  children,
  isLoading,
  error,
  className = "",
}: KanbanLayoutProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        {error}
      </div>
    );
  }

  const content = (
    <div className={`flex gap-4 overflow-x-auto pb-4 h-full ${className}`}>
      {children}
    </div>
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
    >
      {sortableColumns && columnIds ? (
        <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
          {content}
        </SortableContext>
      ) : (
        content
      )}

      <DragOverlay>
        {dragOverlay}
      </DragOverlay>
    </DndContext>
  );
};

export default KanbanLayout;
export { KanbanLayout };
