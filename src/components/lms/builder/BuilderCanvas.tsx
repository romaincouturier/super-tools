import { useCallback, useRef, useState, useMemo } from "react";
import { LmsLesson } from "@/hooks/useLms";
import {
  useLessonBlocks,
  useCreateLessonBlock,
  useUpdateLessonBlock,
  useDeleteLessonBlock,
  useReorderLessonBlocks,
  useDuplicateLessonBlock,
  useInsertLessonTemplate,
} from "@/hooks/useLmsBlocks";
import { LESSON_TEMPLATES } from "@/types/lms-templates";
import { buildBlockTree } from "@/services/lms-blocks";
import type { BlockTreeNode } from "@/services/lms-blocks";
import type { LessonBlockType, LessonBlockContent, RowBlockContent } from "@/types/lms-blocks";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { dropzoneId, parseDropzoneId } from "@/components/lms/blocks/BlockTreeNode";
import BlockEditCard from "@/components/lms/blocks/BlockEditCard";
import { cn } from "@/lib/utils";
import BuilderBlockWrapper from "./BuilderBlockWrapper";
import BuilderInsertMenu from "./BuilderInsertMenu";
import type { TweakValues } from "./BuilderTweaksPanel";
import { Clock, BookOpen, Pencil } from "lucide-react";

// Arc Tilt SVGs — matching design exactly (gradient + arc path)
function TiltArcTopRight() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 520 520"
      className="pointer-events-none select-none"
      style={{
        position: "absolute",
        top: -80,
        right: -120,
        width: 520,
        height: 520,
        color: "var(--st-yellow)",
        opacity: 0.55,
        zIndex: 0,
      }}
    >
      <defs>
        <linearGradient id="arcg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFD100" stopOpacity="0.08" />
          <stop offset="1" stopColor="#FFD100" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="260" cy="260" r="240" fill="none" stroke="url(#arcg)" strokeWidth="80" />
      <path d="M 60 260 A 200 200 0 0 1 460 260" fill="none" stroke="#FFD100" strokeOpacity="0.06" strokeWidth="36" strokeLinecap="round" />
    </svg>
  );
}

function TiltArcBottomLeft() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 380 380"
      className="pointer-events-none select-none"
      style={{
        position: "absolute",
        bottom: -160,
        left: -100,
        width: 380,
        height: 380,
        color: "var(--st-yellow)",
        opacity: 0.35,
        zIndex: 0,
      }}
    >
      <circle cx="190" cy="190" r="170" fill="none" stroke="#FFD100" strokeOpacity="0.045" strokeWidth="44" />
    </svg>
  );
}

// Empty state
function EmptyState({ onInsert, onInsertTemplate }: { onInsert: (type: LessonBlockType) => void; onInsertTemplate?: (id: string) => void }) {
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
            onInsertTemplate={onInsertTemplate}
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
  const insertTemplate = useInsertLessonTemplate(lesson.id);
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

  // Keep ref for H1 input (was textarea, now input — kept for future use)
  const h1Ref = useRef<HTMLInputElement>(null);

  const handleAdd = useCallback(
    (type: LessonBlockType, parentBlockId: string | null = null, atPosition?: number) => {
      createBlock.mutate(
        { type, parentBlockId, atPosition },
        { onError: (err) => toastError(toast, err instanceof Error ? err : "Erreur de création") },
      );
    },
    [createBlock, toast],
  );

  const handleInsertTemplate = useCallback(
    (templateId: string) => {
      const tpl = LESSON_TEMPLATES.find((t) => t.id === templateId);
      if (!tpl) return;
      insertTemplate.mutate(tpl.blocks, {
        onSuccess: () => toast({ title: `Modèle « ${tpl.label} » inséré` }),
        onError: (err) => toastError(toast, err instanceof Error ? err : "Erreur lors de l'insertion du modèle"),
      });
    },
    [insertTemplate, toast],
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
      // When landing on a dropzone of the same parent, move to the end of the list.
      const newIdx =
        dropzoneParent !== undefined ? siblings.length - 1 : siblings.indexOf(overIdStr);
      if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return;
      reorderBlocks.mutate(arrayMove(siblings, oldIdx, newIdx), {
        onError: (err) => toastError(toast, err instanceof Error ? err : "Erreur de réorganisation"),
      });
    },
    [blocksById, childrenIdsByParent, reorderBlocks, toast],
  );

  const handleMoveUp = useCallback(
    (blockId: string) => {
      const block = blocksById.get(blockId);
      if (!block) return;
      const parentId = block.parent_block_id ?? null;
      const siblings = childrenIdsByParent.get(parentId) || [];
      const idx = siblings.indexOf(blockId);
      if (idx <= 0) return;
      reorderBlocks.mutate(arrayMove(siblings, idx, idx - 1), {
        onError: (err) => toastError(toast, err instanceof Error ? err : "Erreur de déplacement"),
      });
    },
    [blocksById, childrenIdsByParent, reorderBlocks, toast],
  );

  const handleMoveDown = useCallback(
    (blockId: string) => {
      const block = blocksById.get(blockId);
      if (!block) return;
      const parentId = block.parent_block_id ?? null;
      const siblings = childrenIdsByParent.get(parentId) || [];
      const idx = siblings.indexOf(blockId);
      if (idx < 0 || idx >= siblings.length - 1) return;
      reorderBlocks.mutate(arrayMove(siblings, idx, idx + 1), {
        onError: (err) => toastError(toast, err instanceof Error ? err : "Erreur de déplacement"),
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
        className="mx-auto flex flex-col"
        style={{
          maxWidth: contentWidth,
          position: "relative",
          padding: "4rem 2rem",
          gap: density === "compact" ? "1rem" : density === "spacious" ? "2rem" : "1.5rem",
          zIndex: 1,
        }}
      >
        {/* Metadata chips */}
        <div className="flex flex-wrap items-center gap-3">
          {moduleName && (
            <Chip icon={<BookOpen size={11} />}>
              {moduleName}
              {sequenceNumber != null && ` · Séquence ${sequenceNumber}`}
            </Chip>
          )}
        </div>

        {/* H1 — input matching design lesson-h1 */}
        <input
          ref={h1Ref as React.RefObject<HTMLInputElement>}
          value={titleValue}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Titre de la leçon…"
          className="w-full border-none outline-none"
          style={{
            fontSize: h1Size,
            fontWeight: 700,
            lineHeight: 1.2,
            color: "var(--st-ink)",
            letterSpacing: "-0.02em",
            padding: ".25rem 0",
            fontFamily: "inherit",
            background: "transparent",
          }}
          aria-label="Titre de la leçon"
        />

        {/* Blocks */}
        {isLoading ? (
          <div className="py-12 text-center text-sm" style={{ color: "var(--st-ink-muted)" }}>
            Chargement…
          </div>
        ) : tree.length === 0 ? (
          <EmptyState onInsert={(type) => handleAdd(type, null)} onInsertTemplate={handleInsertTemplate} />
        ) : (
          <>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <RootDropzone hasChildren={tree.length > 0} density={density}>
                <SortableContext items={rootIds} strategy={verticalListSortingStrategy}>
                  {tree.map((node, idx) => (
                    <SortableBuilderBlock
                      key={node.block.id}
                      node={node}
                      siblingIndex={idx}
                      siblingCount={tree.length}
                      lessonId={lesson.id}
                      courseId={courseId}
                      blockRadius={blockRadius}
                      density={density}
                      onDelete={handleDelete}
                      onDuplicate={handleDuplicate}
                      onAdd={handleAdd}
                      onUpdateContent={handleUpdateContent}
                      onToggleHidden={handleToggleHidden}
                      onMoveUp={handleMoveUp}
                      onMoveDown={handleMoveDown}
                    />
                  ))}
                </SortableContext>
              </RootDropzone>
            </DndContext>
            <AddAtEndButton onInsert={(type) => handleAdd(type, null)} onInsertTemplate={handleInsertTemplate} />
          </>
        )}
      </div>
    </div>
  );
}

function SortableBuilderBlock({
  node,
  siblingIndex,
  siblingCount,
  lessonId,
  courseId,
  blockRadius,
  density,
  onDelete,
  onDuplicate,
  onAdd,
  onUpdateContent,
  onToggleHidden,
  onMoveUp,
  onMoveDown,
}: {
  node: BlockTreeNode;
  siblingIndex: number;
  siblingCount: number;
  lessonId: string;
  courseId: string;
  blockRadius: number;
  density: "compact" | "normal" | "spacious";
  onDelete: (blockId: string) => void;
  onDuplicate: (blockId: string) => void;
  onAdd: (type: LessonBlockType, parentBlockId: string | null, atPosition?: number) => void;
  onUpdateContent: (blockId: string, content: LessonBlockContent) => Promise<void>;
  onToggleHidden: (blockId: string, hidden: boolean) => void;
  onMoveUp: (blockId: string) => void;
  onMoveDown: (blockId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.block.id,
    data: { type: "block", parentId: node.block.parent_block_id ?? null, blockId: node.block.id },
  });

  const isContainer =
    node.block.type === "section" ||
    node.block.type === "row" ||
    node.block.type === "container" ||
    node.block.type === "reveal";
  const hasChildren = node.children.length > 0;
  const childIds = node.children.map((c) => c.block.id);
  const gapClass = DENSITY_GAP[density] ?? "space-y-3";

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : undefined,
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      <BuilderBlockWrapper
        blockRadius={blockRadius}
        density={density}
        onDelete={() => onDelete(node.block.id)}
        onDuplicate={() => onDuplicate(node.block.id)}
        onInsertAfter={(type) => onAdd(type, node.block.parent_block_id ?? null, node.block.position + 1)}
        onMoveUp={siblingIndex > 0 ? () => onMoveUp(node.block.id) : undefined}
        onMoveDown={siblingIndex < siblingCount - 1 ? () => onMoveDown(node.block.id) : undefined}
        dragHandleProps={{ ...attributes, ...listeners }}
      >
        <BlockEditCard
          block={node.block}
          lessonId={lessonId}
          courseId={courseId}
          onUpdateContent={(content) => onUpdateContent(node.block.id, content)}
          onToggleHidden={(hidden) => onToggleHidden(node.block.id, hidden)}
          onDelete={() => onDelete(node.block.id)}
          onDuplicate={() => onDuplicate(node.block.id)}
          slim
        />
      </BuilderBlockWrapper>
      {(isContainer || hasChildren) && (() => {
        const isRow = node.block.type === "row";
        const colCount = isRow ? ((node.block.content as RowBlockContent).column_count ?? 2) : 1;
        const GRID_COLS: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3" };
        const COL_SPAN: Record<number, string> = { 1: "col-span-1", 2: "col-span-2", 3: "col-span-3" };
        return (
          <div
            className={isRow
              ? `mt-3 grid gap-3 ${GRID_COLS[colCount] ?? "grid-cols-2"}`
              : cn(gapClass, "mt-3 ml-4 pl-4 border-l-2 border-dashed")}
            style={isRow ? undefined : { borderColor: "rgba(16,24,32,0.12)" }}
          >
            {hasChildren && (
              <SortableContext items={childIds} strategy={isRow ? rectSortingStrategy : verticalListSortingStrategy}>
                {node.children.map((child, idx) => (
                  <SortableBuilderBlock
                    key={child.block.id}
                    node={child}
                    siblingIndex={idx}
                    siblingCount={node.children.length}
                    lessonId={lessonId}
                    courseId={courseId}
                    blockRadius={blockRadius}
                    density={density}
                    onDelete={onDelete}
                    onDuplicate={onDuplicate}
                    onAdd={onAdd}
                    onUpdateContent={onUpdateContent}
                    onToggleHidden={onToggleHidden}
                    onMoveUp={onMoveUp}
                    onMoveDown={onMoveDown}
                  />
                ))}
              </SortableContext>
            )}
            {isContainer && (
              <div className={isRow ? (COL_SPAN[colCount] ?? "col-span-2") : undefined}>
                <AddAtEndButton onInsert={(type) => onAdd(type, node.block.id)} />
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

function AddAtEndButton({ onInsert, onInsertTemplate }: { onInsert: (type: LessonBlockType) => void; onInsertTemplate?: (id: string) => void }) {
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
          onInsertTemplate={onInsertTemplate}
          onClose={() => setMenuOpen(false)}
          placement="top"
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
