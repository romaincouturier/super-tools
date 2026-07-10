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
import { buildBlockTree, rowColumnAssignments, splitRowColumns } from "@/services/lms-blocks";
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

  /**
   * Row context of a block: returns null unless the block is a direct child
   * of a row. Assignments are materialised (fallback included) so any
   * structural action pins every child to its current column.
   */
  const rowContextOf = useCallback(
    (blockId: string) => {
      const block = blocksById.get(blockId);
      if (!block?.parent_block_id) return null;
      const parent = blocksById.get(block.parent_block_id);
      if (!parent || parent.type !== "row") return null;
      const content = parent.content as RowBlockContent;
      const siblings = childrenIdsByParent.get(parent.id) || [];
      return { parent, content, siblings, assignments: rowColumnAssignments(content, siblings) };
    },
    [blocksById, childrenIdsByParent],
  );

  const persistRowAssignments = useCallback(
    (rowId: string, content: RowBlockContent, assignments: Record<string, number>) => {
      updateBlock.mutate(
        { id: rowId, updates: { content: { ...content, column_assignments: assignments } } },
        { onError: (err) => toastError(toast, err instanceof Error ? err : "Erreur de mise à jour des colonnes") },
      );
    },
    [updateBlock, toast],
  );

  const handleAdd = useCallback(
    (type: LessonBlockType, parentBlockId: string | null = null, atPosition?: number, column?: number) => {
      // Snapshot the row assignments BEFORE the insert shifts sibling
      // positions, so existing children keep their current column.
      const row = column != null && parentBlockId ? blocksById.get(parentBlockId) : undefined;
      const snapshot =
        row && row.type === "row"
          ? rowColumnAssignments(row.content as RowBlockContent, childrenIdsByParent.get(parentBlockId!) || [])
          : undefined;
      createBlock.mutate(
        { type, parentBlockId, atPosition },
        {
          onSuccess: (created) => {
            if (!row || row.type !== "row" || !snapshot || column == null) return;
            persistRowAssignments(row.id, row.content as RowBlockContent, {
              ...snapshot,
              [created.id]: column,
            });
          },
          onError: (err) => toastError(toast, err instanceof Error ? err : "Erreur de création"),
        },
      );
    },
    [createBlock, blocksById, childrenIdsByParent, persistRowAssignments, toast],
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
    (blockId: string) => {
      const ctx = rowContextOf(blockId);
      duplicateBlock.mutate(blockId, {
        onSuccess: (newId) => {
          if (!ctx) return;
          persistRowAssignments(ctx.parent.id, ctx.content, {
            ...ctx.assignments,
            [newId]: ctx.assignments[blockId],
          });
        },
        onError: (err) => toastError(toast, err instanceof Error ? err : "Erreur de duplication"),
      });
    },
    [duplicateBlock, rowContextOf, persistRowAssignments, toast],
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
      const parentBlock = activeParentId ? blocksById.get(activeParentId) : undefined;
      if (parentBlock?.type === "row" && dropzoneParent === undefined) {
        // Row children: dropping on a block also adopts its column, then the
        // materialised assignments pin every child so the reorder cannot
        // shift legacy fallback columns.
        const content = parentBlock.content as RowBlockContent;
        const assignments = rowColumnAssignments(content, siblings);
        const overIdx = siblings.indexOf(overIdStr);
        if (oldIdx < 0 || overIdx < 0) return;
        assignments[String(active.id)] = assignments[overIdStr];
        persistRowAssignments(parentBlock.id, content, assignments);
        if (oldIdx !== overIdx) {
          reorderBlocks.mutate(arrayMove(siblings, oldIdx, overIdx), {
            onError: (err) => toastError(toast, err instanceof Error ? err : "Erreur de réorganisation"),
          });
        }
        return;
      }
      // When landing on a dropzone of the same parent, move to the end of the list.
      const newIdx =
        dropzoneParent !== undefined ? siblings.length - 1 : siblings.indexOf(overIdStr);
      if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return;
      reorderBlocks.mutate(arrayMove(siblings, oldIdx, newIdx), {
        onError: (err) => toastError(toast, err instanceof Error ? err : "Erreur de réorganisation"),
      });
    },
    [blocksById, childrenIdsByParent, reorderBlocks, persistRowAssignments, toast],
  );

  /** Swap the block with its previous/next neighbour WITHIN its row column. */
  const moveWithinRowColumn = useCallback(
    (blockId: string, direction: -1 | 1) => {
      const ctx = rowContextOf(blockId);
      if (!ctx) return false;
      const col = ctx.assignments[blockId];
      const members = ctx.siblings.filter((id) => ctx.assignments[id] === col);
      const idx = members.indexOf(blockId);
      const otherIdx = idx + direction;
      if (idx < 0 || otherIdx < 0 || otherIdx >= members.length) return true;
      const other = members[otherIdx];
      const newOrder = ctx.siblings.map((id) =>
        id === blockId ? other : id === other ? blockId : id,
      );
      persistRowAssignments(ctx.parent.id, ctx.content, ctx.assignments);
      reorderBlocks.mutate(newOrder, {
        onError: (err) => toastError(toast, err instanceof Error ? err : "Erreur de déplacement"),
      });
      return true;
    },
    [rowContextOf, persistRowAssignments, reorderBlocks, toast],
  );

  const handleMoveUp = useCallback(
    (blockId: string) => {
      if (moveWithinRowColumn(blockId, -1)) return;
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
    [blocksById, childrenIdsByParent, reorderBlocks, moveWithinRowColumn, toast],
  );

  const handleMoveDown = useCallback(
    (blockId: string) => {
      if (moveWithinRowColumn(blockId, 1)) return;
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
    [blocksById, childrenIdsByParent, reorderBlocks, moveWithinRowColumn, toast],
  );

  const handleMoveToColumn = useCallback(
    (blockId: string, column: number) => {
      const ctx = rowContextOf(blockId);
      if (!ctx) return;
      persistRowAssignments(ctx.parent.id, ctx.content, { ...ctx.assignments, [blockId]: column });
    },
    [rowContextOf, persistRowAssignments],
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
                      onMoveToColumn={handleMoveToColumn}
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
  columnIndex,
  columnCount,
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
  onMoveToColumn,
}: {
  node: BlockTreeNode;
  siblingIndex: number;
  siblingCount: number;
  /** Set when the block is a direct child of a row — its current column. */
  columnIndex?: number;
  /** Set when the block is a direct child of a row — the row's column count. */
  columnCount?: number;
  lessonId: string;
  courseId: string;
  blockRadius: number;
  density: "compact" | "normal" | "spacious";
  onDelete: (blockId: string) => void;
  onDuplicate: (blockId: string) => void;
  onAdd: (type: LessonBlockType, parentBlockId: string | null, atPosition?: number, column?: number) => void;
  onUpdateContent: (blockId: string, content: LessonBlockContent) => Promise<void>;
  onToggleHidden: (blockId: string, hidden: boolean) => void;
  onMoveUp: (blockId: string) => void;
  onMoveDown: (blockId: string) => void;
  onMoveToColumn: (blockId: string, column: number) => void;
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
        onInsertAfter={(type) => onAdd(type, node.block.parent_block_id ?? null, node.block.position + 1, columnIndex)}
        onMoveUp={siblingIndex > 0 ? () => onMoveUp(node.block.id) : undefined}
        onMoveDown={siblingIndex < siblingCount - 1 ? () => onMoveDown(node.block.id) : undefined}
        onMoveLeft={
          columnIndex != null && columnIndex > 0
            ? () => onMoveToColumn(node.block.id, columnIndex - 1)
            : undefined
        }
        onMoveRight={
          columnIndex != null && columnCount != null && columnIndex < columnCount - 1
            ? () => onMoveToColumn(node.block.id, columnIndex + 1)
            : undefined
        }
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
      {node.block.type === "row" && (() => {
        const rowContent = node.block.content as RowBlockContent;
        const colCount = rowContent.column_count ?? 2;
        const GRID_COLS: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3" };
        const columns = splitRowColumns(
          { ...rowContent, column_count: colCount },
          node.children,
          (c) => c.block.id,
        );
        return (
          <div className={`mt-3 grid gap-3 items-start ${GRID_COLS[colCount] ?? "grid-cols-2"}`}>
            {columns.map((colNodes, colIdx) => (
              <div
                key={colIdx}
                className="min-w-0 rounded-lg border border-dashed p-2"
                style={{ borderColor: "rgba(16,24,32,0.12)" }}
              >
                <div className={gapClass}>
                  <SortableContext items={colNodes.map((c) => c.block.id)} strategy={verticalListSortingStrategy}>
                    {colNodes.map((child, idx) => (
                      <SortableBuilderBlock
                        key={child.block.id}
                        node={child}
                        siblingIndex={idx}
                        siblingCount={colNodes.length}
                        columnIndex={colIdx}
                        columnCount={colCount}
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
                        onMoveToColumn={onMoveToColumn}
                      />
                    ))}
                  </SortableContext>
                </div>
                <AddAtEndButton onInsert={(type) => onAdd(type, node.block.id, undefined, colIdx)} />
              </div>
            ))}
          </div>
        );
      })()}
      {node.block.type !== "row" && (isContainer || hasChildren) && (
        <div
          className={cn(gapClass, "mt-3 ml-4 pl-4 border-l-2 border-dashed")}
          style={{ borderColor: "rgba(16,24,32,0.12)" }}
        >
          {hasChildren && (
            <SortableContext items={childIds} strategy={verticalListSortingStrategy}>
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
                  onMoveToColumn={onMoveToColumn}
                />
              ))}
            </SortableContext>
          )}
          {isContainer && <AddAtEndButton onInsert={(type) => onAdd(type, node.block.id)} />}
        </div>
      )}
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
