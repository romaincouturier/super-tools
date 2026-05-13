import {
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { LessonBlockContent, LessonBlockType } from "@/types/lms-blocks";
import type { BlockTreeNode } from "@/services/lms-blocks";
import BlockEditCard from "./BlockEditCard";

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
  /** Required by the interface; unused in the builder which has no nested blocks. */
  onAddChild: (parentBlockId: string, type: LessonBlockType) => void;
  /** Builder mode — suppresses the BlockEditCard toolbar. */
  slim?: boolean;
}

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
        slim={props.slim}
      />
    </div>
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
