import type { ReactNode } from "react";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  acceptsChildren,
  type LessonBlockContent,
  type LessonBlockType,
  type RowBlockContent,
} from "@/types/lms-blocks";
import type { BlockTreeNode } from "@/services/lms-blocks";
import BlockEditCard from "./BlockEditCard";
import { LAYOUT_BLOCKS, CONTENT_BLOCKS, type BlockTypeMeta } from "./registry";

export interface BlockTreeNodeProps {
  node: BlockTreeNode;
  /** Parent of this node — used by DnD to know where the dragged item came from. */
  parentId: string | null;
  lessonId: string;
  courseId?: string;
  onUpdateContent: (blockId: string, content: LessonBlockContent) => Promise<void>;
  onToggleHidden: (blockId: string, hidden: boolean) => void;
  onDelete: (blockId: string) => void;
  onDuplicate: (blockId: string) => void;
  onAddChild: (parentBlockId: string, type: LessonBlockType) => void;
}

/**
 * One node of the block tree in the back-office editor. Sortable in its
 * parent's `SortableContext`. If the underlying block accepts children
 * (section, row, container), renders a nested children zone with its
 * own SortableContext + drop placeholder + add buttons.
 */
export default function BlockTreeNodeView(props: BlockTreeNodeProps) {
  const { node, parentId } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.block.id,
    data: { type: "block", parentId, blockId: node.block.id },
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <BlockEditCard
        block={node.block}
        lessonId={props.lessonId}
        courseId={props.courseId}
        onUpdateContent={(content) => props.onUpdateContent(node.block.id, content)}
        onToggleHidden={(hidden) => props.onToggleHidden(node.block.id, hidden)}
        onDelete={() => props.onDelete(node.block.id)}
        onDuplicate={() => props.onDuplicate(node.block.id)}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
      {acceptsChildren(node.block.type) && (
        <ChildrenZone
          parentBlockId={node.block.id}
          children={node.children}
          rowContent={node.block.type === "row" ? (node.block.content as RowBlockContent) : null}
          isRow={node.block.type === "row"}
          {...props}
        />
      )}
    </div>
  );
}

interface ChildrenZoneProps extends BlockTreeNodeProps {
  parentBlockId: string;
  children: BlockTreeNode[];
  rowContent: RowBlockContent | null;
  isRow: boolean;
}

const ROW_GRID_CLASS: Record<1 | 2 | 3, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-3",
};

function ChildrenZone(props: ChildrenZoneProps) {
  const { parentBlockId, children, rowContent, isRow } = props;
  const childIds = children.map((c) => c.block.id);
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: dropzoneId(parentBlockId),
    data: { type: "dropzone", parentId: parentBlockId },
  });

  const isEmpty = children.length === 0;
  const layoutClass = isRow
    ? cn("grid gap-3", ROW_GRID_CLASS[(rowContent?.column_count ?? 1) as 1 | 2 | 3])
    : "space-y-3";

  return (
    <div
      ref={setDropRef}
      className={cn(
        "ml-4 mt-2 pl-3 border-l-2 border-dashed border-muted-foreground/20",
        isOver && "border-primary/50 bg-primary/5",
      )}
    >
      <SortableContext
        items={childIds}
        strategy={isRow ? rectSortingStrategy : verticalListSortingStrategy}
      >
        <div className={layoutClass}>
          {children.map((child) => (
            <BlockTreeNodeView
              key={child.block.id}
              node={child}
              parentId={parentBlockId}
              lessonId={props.lessonId}
              courseId={props.courseId}
              onUpdateContent={props.onUpdateContent}
              onToggleHidden={props.onToggleHidden}
              onDelete={props.onDelete}
              onDuplicate={props.onDuplicate}
              onAddChild={props.onAddChild}
            />
          ))}
          {isEmpty && (
            <p className="text-xs text-muted-foreground italic py-3 text-center">
              Glissez un bloc ici ou utilisez les boutons ci-dessous.
            </p>
          )}
        </div>
      </SortableContext>
      <div className="flex flex-col sm:flex-row gap-2 mt-2">
        <ChildAddButton
          label="Ajouter une section"
          types={LAYOUT_BLOCKS}
          onPick={(t) => props.onAddChild(parentBlockId, t)}
        />
        <ChildAddButton
          label="Ajouter un contenu"
          types={CONTENT_BLOCKS}
          onPick={(t) => props.onAddChild(parentBlockId, t)}
        />
      </div>
    </div>
  );
}

function ChildAddButton({
  label,
  types,
  onPick,
}: {
  label: string;
  types: BlockTypeMeta[];
  onPick: (type: LessonBlockType) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs h-7">
          <Plus className="w-3 h-3 mr-1" />
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

/** Stable id for the droppable wrapping a container's children list. */
export function dropzoneId(parentId: string | null): string {
  return `dropzone:${parentId ?? "__root__"}`;
}

export function parseDropzoneId(id: string): string | null | undefined {
  if (!id.startsWith("dropzone:")) return undefined;
  const raw = id.slice("dropzone:".length);
  return raw === "__root__" ? null : raw;
}
