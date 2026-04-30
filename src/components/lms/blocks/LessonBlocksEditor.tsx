import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
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
  useMoveLessonBlock,
  useDuplicateLessonBlock,
} from "@/hooks/useLmsBlocks";
import {
  buildBlockTree,
  type BlockTreeNode as BlockTreeNodeType,
} from "@/services/lms-blocks";
import type { LessonBlockType, LessonBlockContent, LessonBlock } from "@/types/lms-blocks";
import { LAYOUT_BLOCKS, CONTENT_BLOCKS, type BlockTypeMeta } from "./registry";
import BlockTreeNodeView, { dropzoneId, parseDropzoneId } from "./BlockTreeNode";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

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
  const moveBlock = useMoveLessonBlock(lessonId);
  const duplicateBlock = useDuplicateLessonBlock(lessonId);
  const { toast } = useToast();

  const tree = useMemo(() => buildBlockTree(blocks), [blocks]);

  // Children IDs grouped by parent — drives both rendering and DnD index lookup.
  const childrenIdsByParent = useMemo(() => {
    const m = new Map<string | null, string[]>();
    const visit = (nodes: BlockTreeNodeType[], parentId: string | null) => {
      m.set(parentId, nodes.map((n) => n.block.id));
      for (const n of nodes) visit(n.children, n.block.id);
    };
    visit(tree, null);
    return m;
  }, [tree]);

  const blocksById = useMemo(() => {
    const m = new Map<string, LessonBlock>();
    for (const b of blocks) m.set(b.id, b);
    return m;
  }, [blocks]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Active block during a drag — used to skip drop targets that would create a cycle.
  const [activeId, setActiveId] = useState<string | null>(null);
  const descendantIds = useMemo(() => {
    if (!activeId) return new Set<string>();
    const out = new Set<string>([activeId]);
    const stack = [activeId];
    while (stack.length > 0) {
      const id = stack.pop()!;
      const kids = childrenIdsByParent.get(id) || [];
      for (const k of kids) {
        out.add(k);
        stack.push(k);
      }
    }
    return out;
  }, [activeId, childrenIdsByParent]);

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const activeBlock = blocksById.get(String(active.id));
    if (!activeBlock) return;
    const activeParentId = activeBlock.parent_block_id ?? null;

    // Resolve the target parent.
    const overIdStr = String(over.id);
    const dropzoneParent = parseDropzoneId(overIdStr);
    let targetParentId: string | null;
    let targetIsBlock: boolean;
    if (dropzoneParent !== undefined) {
      targetParentId = dropzoneParent;
      targetIsBlock = false;
    } else {
      const overData = over.data.current as { parentId?: string | null } | undefined;
      if (!overData || overData.parentId === undefined) return;
      targetParentId = overData.parentId;
      targetIsBlock = true;
    }

    // Cycle prevention: cannot drop a block inside itself or its own subtree.
    if (targetParentId && descendantIds.has(targetParentId)) {
      toastError(toast, "Impossible de déplacer un bloc dans son propre contenu.");
      return;
    }

    if (activeParentId === targetParentId) {
      // Same-parent reorder — use arrayMove and persist the new order.
      const siblings = childrenIdsByParent.get(activeParentId) || [];
      const oldIdx = siblings.indexOf(String(active.id));
      const newIdx = targetIsBlock
        ? siblings.indexOf(overIdStr)
        : siblings.length - 1; // dropzone of same parent → last
      if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return;
      const reordered = arrayMove(siblings, oldIdx, newIdx);
      reorderBlocks.mutate(reordered, {
        onError: (err) => toastError(toast, err instanceof Error ? err : "Erreur de réorganisation"),
      });
      return;
    }

    // Cross-parent move.
    const newSiblings = (childrenIdsByParent.get(targetParentId) || []).filter(
      (id) => id !== String(active.id),
    );
    let newPosition: number;
    if (targetIsBlock) {
      const overIdx = newSiblings.indexOf(overIdStr);
      newPosition = overIdx >= 0 ? overIdx : newSiblings.length;
    } else {
      newPosition = newSiblings.length;
    }
    moveBlock.mutate(
      { blockId: String(active.id), newParentId: targetParentId, newPosition },
      {
        onError: (err) => toastError(toast, err instanceof Error ? err : "Erreur de déplacement"),
      },
    );
  };

  const handleAdd = (type: LessonBlockType, parentBlockId: string | null = null) => {
    createBlock.mutate(
      { type, parentBlockId },
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

  const handleDuplicate = (blockId: string) => {
    duplicateBlock.mutate(blockId, {
      onError: (err) => toastError(toast, err instanceof Error ? err : "Erreur de duplication"),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Spinner className="h-3.5 w-3.5" /> Chargement des blocs…
      </div>
    );
  }

  const rootIds = childrenIdsByParent.get(null) || [];

  return (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <RootDropzone hasChildren={tree.length > 0}>
          <SortableContext items={rootIds} strategy={verticalListSortingStrategy}>
            {tree.map((node) => (
              <BlockTreeNodeView
                key={node.block.id}
                node={node}
                parentId={null}
                lessonId={lessonId}
                courseId={courseId}
                onUpdateContent={handleUpdateContent}
                onToggleHidden={handleToggleHidden}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onAddChild={(parentId, type) => handleAdd(type, parentId)}
              />
            ))}
          </SortableContext>
        </RootDropzone>
      </DndContext>

      {tree.length === 0 && (
        <p className="text-sm text-muted-foreground italic py-4 text-center border border-dashed rounded-lg">
          Aucun bloc pour le moment. Ajoutez-en un ci-dessous.
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <RootAddButton
          label="Ajouter une section"
          types={LAYOUT_BLOCKS}
          disabled={createBlock.isPending}
          onPick={(t) => handleAdd(t, null)}
        />
        <RootAddButton
          label="Ajouter un contenu"
          types={CONTENT_BLOCKS}
          disabled={createBlock.isPending}
          onPick={(t) => handleAdd(t, null)}
        />
      </div>
    </div>
  );
}

function RootDropzone({ hasChildren, children }: { hasChildren: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: dropzoneId(null),
    data: { type: "dropzone", parentId: null },
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "space-y-3",
        !hasChildren && "min-h-[80px] rounded-lg",
        isOver && !hasChildren && "border-2 border-dashed border-primary/50 bg-primary/5",
      )}
    >
      {children}
    </div>
  );
}

function RootAddButton({
  label,
  types,
  disabled,
  onPick,
}: {
  label: string;
  types: BlockTypeMeta[];
  disabled?: boolean;
  onPick: (type: LessonBlockType) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled} className="w-full sm:w-auto">
          {disabled ? <Spinner className="mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 max-h-[60vh] overflow-y-auto">
        {types.map((meta) => {
          const Icon = meta.icon;
          return (
            <DropdownMenuItem
              key={meta.type}
              onClick={() => onPick(meta.type)}
              disabled={!meta.editable}
            >
              <Icon className="w-4 h-4 mr-2" />
              <span className="flex-1">{meta.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
