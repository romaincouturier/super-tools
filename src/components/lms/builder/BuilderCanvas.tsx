import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { LmsLesson } from "@/hooks/useLms";
import {
  useLessonBlocks,
  useCreateLessonBlock,
  useUpdateLessonBlock,
  useDeleteLessonBlock,
  useReorderLessonBlocks,
  useDuplicateLessonBlock,
} from "@/hooks/useLmsBlocks";
import { buildBlockTree } from "@/services/lms-blocks";
import type { LessonBlockType, LessonBlockContent } from "@/types/lms-blocks";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
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
  arrayMove,
} from "@dnd-kit/sortable";
import BlockTreeNodeView, { dropzoneId, parseDropzoneId } from "@/components/lms/blocks/BlockTreeNode";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import BuilderBlockWrapper from "./BuilderBlockWrapper";
import BuilderInsertMenu from "./BuilderInsertMenu";
import type { TweakValues } from "./BuilderTweaksPanel";
import { Clock, BookOpen, Pencil } from "lucide-react";

// Arc Tilt SVG watermarks
function TiltArcTopRight() {
  return (
    <svg
      className="absolute top-0 right-0 pointer-events-none select-none"
      width="220"
      height="220"
      viewBox="0 0 220 220"
      fill="none"
      aria-hidden="true"
      style={{ opacity: 0.055 }}
    >
      <circle cx="220" cy="0" r="160" stroke="#101820" strokeWidth="28" fill="none" />
      <circle cx="220" cy="0" r="110" stroke="#FFD100" strokeWidth="8" fill="none" />
    </svg>
  );
}

function TiltArcBottomLeft() {
  return (
    <svg
      className="absolute bottom-0 left-0 pointer-events-none select-none"
      width="180"
      height="180"
      viewBox="0 0 180 180"
      fill="none"
      aria-hidden="true"
      style={{ opacity: 0.04 }}
    >
      <circle cx="0" cy="180" r="130" stroke="#101820" strokeWidth="22" fill="none" />
      <circle cx="0" cy="180" r="85" stroke="#FFD100" strokeWidth="7" fill="none" />
    </svg>
  );
}

// Empty state
function EmptyState({ onInsert }: { onInsert: (type: LessonBlockType) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-5">
      {/* Pencil illustration */}
      <div
        className="w-16 h-16 flex items-center justify-center rounded-2xl"
        style={{ background: "var(--st-yellow-soft)" }}
      >
        <Pencil size={28} style={{ color: "var(--st-ink)" }} />
      </div>
      <div className="text-center">
        <p className="text-base font-semibold mb-1" style={{ color: "var(--st-ink)" }}>
          Cette leçon est vide
        </p>
        <p className="text-sm" style={{ color: "var(--st-ink-muted)" }}>
          Ajoutez votre premier bloc pour commencer à rédiger.
        </p>
      </div>
      <div className="relative">
        <button
          ref={btnRef}
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all hover:-translate-y-px"
          style={{
            background: "var(--st-ink)",
            color: "#fff",
            fontFamily: "inherit",
          }}
        >
          + Ajouter un bloc
        </button>
        {menuOpen && (
          <BuilderInsertMenu
            anchorRef={btnRef as React.RefObject<HTMLElement>}
            onInsert={onInsert}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

interface Props {
  lesson: LmsLesson;
  courseId: string;
  tweaks: TweakValues;
  moduleName?: string;
  sequenceNumber?: number;
  titleValue: string;
  onTitleChange: (value: string) => void;
}

export default function BuilderCanvas({ lesson, courseId, tweaks, moduleName, sequenceNumber, titleValue, onTitleChange }: Props) {
  const { data: blocks = [], isLoading } = useLessonBlocks(lesson.id);
  const createBlock = useCreateLessonBlock(lesson.id);
  const updateBlock = useUpdateLessonBlock(lesson.id);
  const deleteBlock = useDeleteLessonBlock(lesson.id);
  const reorderBlocks = useReorderLessonBlocks(lesson.id);
  const duplicateBlock = useDuplicateLessonBlock(lesson.id);
  const { toast } = useToast();

  const tree = useMemo(() => buildBlockTree(blocks), [blocks]);
  const childrenIdsByParent = useMemo(() => {
    const m = new Map<string | null, string[]>();
    const visit = (nodes: typeof tree, parentId: string | null) => {
      m.set(parentId, nodes.map((n) => n.block.id));
      for (const n of nodes) visit(n.children, n.block.id);
    };
    visit(tree, null);
    return m;
  }, [tree]);

  const blocksById = useMemo(() => {
    const m = new Map<string, (typeof blocks)[0]>();
    for (const b of blocks) m.set(b.id, b);
    return m;
  }, [blocks]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Auto-resize H1 textarea on mount and whenever titleValue changes from outside
  const h1Ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = h1Ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [titleValue]);

  const handleAdd = useCallback(
    (type: LessonBlockType, parentBlockId: string | null = null) => {
      createBlock.mutate(
        { type, parentBlockId },
        { onError: (err) => toastError(toast, err instanceof Error ? err : "Erreur de création") },
      );
    },
    [createBlock, toast],
  );

  const handleUpdateContent = useCallback(
    async (blockId: string, content: LessonBlockContent) => {
      await updateBlock.mutateAsync({ id: blockId, updates: { content } });
    },
    [updateBlock],
  );

  const handleToggleHidden = useCallback(
    (blockId: string, hidden: boolean) => updateBlock.mutate({ id: blockId, updates: { hidden } }),
    [updateBlock],
  );

  const handleDelete = useCallback(
    (blockId: string) =>
      deleteBlock.mutate(blockId, {
        onError: (err) => toastError(toast, err instanceof Error ? err : "Erreur de suppression"),
      }),
    [deleteBlock, toast],
  );

  const handleDuplicate = useCallback(
    (blockId: string) =>
      duplicateBlock.mutate(blockId, {
        onError: (err) => toastError(toast, err instanceof Error ? err : "Erreur de duplication"),
      }),
    [duplicateBlock, toast],
  );

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e;
      if (!over || active.id === over.id) return;
      const activeBlock = blocksById.get(String(active.id));
      if (!activeBlock) return;
      const activeParentId = activeBlock.parent_block_id ?? null;
      const overIdStr = String(over.id);
      const dropzoneParent = parseDropzoneId(overIdStr);
      const targetParentId =
        dropzoneParent !== undefined
          ? dropzoneParent
          : ((over.data.current as { parentId?: string | null } | undefined)?.parentId ?? null);
      if (activeParentId !== targetParentId) return;
      const siblings = childrenIdsByParent.get(activeParentId) || [];
      const oldIdx = siblings.indexOf(String(active.id));
      const newIdx = siblings.indexOf(overIdStr);
      if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return;
      reorderBlocks.mutate(arrayMove(siblings, oldIdx, newIdx), {
        onError: (err) => toastError(toast, err instanceof Error ? err : "Erreur de réorganisation"),
      });
    },
    [blocksById, childrenIdsByParent, reorderBlocks, toast],
  );

  const rootIds = childrenIdsByParent.get(null) || [];

  const h1Size = tweaks.h1Size;
  const contentWidth = tweaks.contentWidth;
  const blockRadius = tweaks.blockRadius;
  const density = tweaks.density;

  return (
    <div
      className="relative min-h-full overflow-hidden"
      style={{ background: "var(--st-white)" }}
    >
      {/* Arc Tilt watermarks */}
      {tweaks.showArc && <TiltArcTopRight />}
      {tweaks.showArc && <TiltArcBottomLeft />}

      <div
        className="mx-auto"
        style={{ maxWidth: contentWidth, position: "relative", padding: "4rem 2rem" }}
      >
        {/* Metadata chips */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          {moduleName && (
            <Chip icon={<BookOpen size={11} />}>
              {moduleName}
              {sequenceNumber != null && ` · Séquence ${sequenceNumber}`}
            </Chip>
          )}
          {lesson.estimated_minutes > 0 && (
            <Chip icon={<Clock size={11} />}>
              ~{lesson.estimated_minutes} min de lecture
            </Chip>
          )}
        </div>

        {/* H1 — editable textarea that auto-resizes, state lifted to LessonBuilderPage */}
        <textarea
          ref={h1Ref}
          value={titleValue}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Titre de la leçon…"
          rows={1}
          className="w-full resize-none bg-transparent border-none outline-none mb-8 leading-tight overflow-hidden"
          style={{
            fontSize: h1Size,
            fontWeight: 700,
            fontFamily: "'Lexend', ui-sans-serif, system-ui, sans-serif",
            color: "var(--st-ink)",
            lineHeight: 1.15,
          }}
          aria-label="Titre de la leçon"
        />

        {/* Blocks */}
        {isLoading ? (
          <div className="py-12 text-center text-sm" style={{ color: "var(--st-ink-muted)" }}>
            Chargement…
          </div>
        ) : tree.length === 0 ? (
          <EmptyState onInsert={(type) => handleAdd(type, null)} />
        ) : (
          <>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <RootDropzone hasChildren={tree.length > 0} density={density}>
                <SortableContext items={rootIds} strategy={verticalListSortingStrategy}>
                  {tree.map((node) => (
                    <BuilderBlockWrapper
                      key={node.block.id}
                      blockRadius={blockRadius}
                      density={density}
                      onDelete={() => handleDelete(node.block.id)}
                      onDuplicate={() => handleDuplicate(node.block.id)}
                      onInsertAfter={(type) => handleAdd(type, null)}
                    >
                      <BlockTreeNodeView
                        node={node}
                        parentId={null}
                        lessonId={lesson.id}
                        courseId={courseId}
                        onUpdateContent={handleUpdateContent}
                        onToggleHidden={handleToggleHidden}
                        onDelete={handleDelete}
                        onDuplicate={handleDuplicate}
                        onAddChild={(parentId, type) => handleAdd(type, parentId)}
                        slim
                      />
                    </BuilderBlockWrapper>
                  ))}
                </SortableContext>
              </RootDropzone>
            </DndContext>
            <AddAtEndButton onInsert={(type) => handleAdd(type, null)} />
          </>
        )}
      </div>
    </div>
  );
}

function AddAtEndButton({ onInsert }: { onInsert: (type: LessonBlockType) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative flex justify-center mt-6">
      <button
        ref={btnRef}
        onClick={() => setMenuOpen((v) => !v)}
        className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all hover:-translate-y-px border-2 border-dashed"
        style={{
          borderColor: "rgba(16,24,32,0.18)",
          color: "var(--st-ink-muted)",
          background: "transparent",
          fontFamily: "inherit",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--st-yellow)";
          (e.currentTarget as HTMLElement).style.color = "var(--st-ink)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(16,24,32,0.18)";
          (e.currentTarget as HTMLElement).style.color = "var(--st-ink-muted)";
        }}
      >
        + Ajouter un bloc
      </button>
      {menuOpen && (
        <BuilderInsertMenu
          anchorRef={btnRef as React.RefObject<HTMLElement>}
          onInsert={onInsert}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full"
      style={{
        background: "var(--st-surface)",
        color: "var(--st-ink-muted)",
        fontFamily: "'Lexend', ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {icon}
      {children}
    </span>
  );
}

const DENSITY_GAP: Record<string, string> = {
  compact: "space-y-1",
  normal: "space-y-3",
  spacious: "space-y-5",
};

function RootDropzone({ hasChildren, density, children }: { hasChildren: boolean; density: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: dropzoneId(null),
    data: { type: "dropzone", parentId: null },
  });
  const gapClass = DENSITY_GAP[density] ?? "space-y-3";
  return (
    <div
      ref={setNodeRef}
      className={cn(
        gapClass,
        !hasChildren && "min-h-[80px] rounded-lg",
        isOver && !hasChildren && "border-2 border-dashed border-primary/50 bg-primary/5",
      )}
    >
      {children}
    </div>
  );
}
