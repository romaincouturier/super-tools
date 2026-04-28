import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import {
  useLessonBlocks,
  useCreateLessonBlock,
  useUpdateLessonBlock,
  useDeleteLessonBlock,
  useReorderLessonBlocks,
} from "@/hooks/useLmsBlocks";
import type { LessonBlock, LessonBlockType, LessonBlockContent } from "@/types/lms-blocks";
import { BLOCK_TYPES } from "./registry";
import BlockEditCard from "./BlockEditCard";

interface Props {
  lessonId: string;
  /** Threaded through to type-specific editors that need course-scoped data (e.g. quiz picker). */
  courseId?: string;
}

export default function LessonBlocksEditor({ lessonId, courseId }: Props) {
  const { data: blocks = [], isLoading } = useLessonBlocks(lessonId);
  const createBlock = useCreateLessonBlock(lessonId);
  const updateBlock = useUpdateLessonBlock(lessonId);
  const deleteBlock = useDeleteLessonBlock(lessonId);
  const reorderBlocks = useReorderLessonBlocks(lessonId);
  const { toast } = useToast();

  // Local order mirrors server order; updated optimistically on drag.
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const orderedIds = localOrder ?? blocks.map((b) => b.id);
  const orderedBlocks = orderedIds
    .map((id) => blocks.find((b) => b.id === id))
    .filter((b): b is LessonBlock => !!b);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedIds.indexOf(String(active.id));
    const newIndex = orderedIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = [...orderedIds];
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved);
    setLocalOrder(next);
    reorderBlocks.mutate(next, {
      onSuccess: () => setLocalOrder(null),
      onError: (err) => {
        setLocalOrder(null);
        toastError(toast, err instanceof Error ? err : "Erreur de réorganisation");
      },
    });
  };

  const handleAdd = (type: LessonBlockType) => {
    createBlock.mutate(
      { type },
      {
        onError: (err) => toastError(toast, err instanceof Error ? err : "Erreur de création"),
      },
    );
  };

  const handleUpdateContent = async (blockId: string, content: LessonBlockContent) => {
    await updateBlock.mutateAsync({ id: blockId, updates: { content } });
  };

  const handleToggleHidden = (blockId: string, hidden: boolean) => {
    updateBlock.mutate({ id: blockId, updates: { hidden } });
  };

  const handleDelete = (blockId: string) => {
    deleteBlock.mutate(blockId, {
      onError: (err) => toastError(toast, err instanceof Error ? err : "Erreur de suppression"),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Spinner className="h-3.5 w-3.5" /> Chargement des blocs…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
          {orderedBlocks.map((block) => (
            <SortableBlock
              key={block.id}
              block={block}
              lessonId={lessonId}
              courseId={courseId}
              onUpdateContent={(content) => handleUpdateContent(block.id, content)}
              onToggleHidden={(hidden) => handleToggleHidden(block.id, hidden)}
              onDelete={() => handleDelete(block.id)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {orderedBlocks.length === 0 && (
        <p className="text-sm text-muted-foreground italic py-4 text-center border border-dashed rounded-lg">
          Aucun bloc pour le moment. Ajoutez-en un ci-dessous.
        </p>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={createBlock.isPending} className="w-full sm:w-auto">
            {createBlock.isPending ? <Spinner className="mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Ajouter un bloc
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {BLOCK_TYPES.map((meta) => {
            const Icon = meta.icon;
            return (
              <DropdownMenuItem
                key={meta.type}
                onClick={() => handleAdd(meta.type)}
                disabled={!meta.editable}
              >
                <Icon className="w-4 h-4 mr-2" />
                <span className="flex-1">{meta.label}</span>
                {!meta.editable && (
                  <span className="text-[10px] text-muted-foreground ml-2">bientôt</span>
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SortableBlock({
  block,
  lessonId,
  courseId,
  onUpdateContent,
  onToggleHidden,
  onDelete,
}: {
  block: LessonBlock;
  lessonId: string;
  courseId?: string;
  onUpdateContent: (content: LessonBlockContent) => Promise<void>;
  onToggleHidden: (hidden: boolean) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <BlockEditCard
        block={block}
        lessonId={lessonId}
        courseId={courseId}
        onUpdateContent={onUpdateContent}
        onToggleHidden={onToggleHidden}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}
