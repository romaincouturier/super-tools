import { useRef, useState } from "react";
import { Trash2, GripVertical, Copy, ChevronUp, ChevronDown } from "lucide-react";
import { InsertButton } from "./BuilderInsertMenu";
import BuilderInsertMenu from "./BuilderInsertMenu";
import type { LessonBlockType } from "@/types/lms-blocks";

interface Props {
  blockRadius: number;
  density: "compact" | "normal" | "spacious";
  onDelete: () => void;
  onDuplicate: () => void;
  onInsertAfter: (type: LessonBlockType) => void;
  /** Called when the user clicks "move up". Omit to hide the button. */
  onMoveUp?: () => void;
  /** Called when the user clicks "move down". Omit to hide the button. */
  onMoveDown?: () => void;
  /** Drag-handle attributes+listeners from useSortable — enables the grip button. */
  dragHandleProps?: Record<string, unknown>;
  children: React.ReactNode;
}

const DENSITY_PY: Record<string, string> = {
  compact: "py-2",
  normal: "py-3",
  spacious: "py-5",
};

export default function BuilderBlockWrapper({
  blockRadius,
  density,
  onDelete,
  onDuplicate,
  onInsertAfter,
  onMoveUp,
  onMoveDown,
  dragHandleProps,
  children,
}: Props) {
  const [hovered, setHovered] = useState(false);
  const [insertOpen, setInsertOpen] = useState(false);
  const insertBtnRef = useRef<HTMLDivElement>(null);

  const py = DENSITY_PY[density] ?? "py-3";

  return (
    <div
      className="relative group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setHovered(false);
          if (!insertOpen) setInsertOpen(false);
        }
      }}
    >
      {/* Block content */}
      <div
        className={`relative px-6 ${py} transition-shadow`}
        style={{
          background: "var(--st-white)",
          borderRadius: blockRadius,
          boxShadow: hovered ? "var(--st-shadow-block)" : "none",
        }}
      >
        {/* Hover action buttons */}
        {hovered && (
          <div
            className="absolute right-3 top-3 flex items-center gap-1 z-10"
            onMouseEnter={() => setHovered(true)}
          >
            {/* Grip handle */}
            <button
              type="button"
              aria-label="Déplacer le bloc"
              className="w-7 h-7 flex items-center justify-center transition-colors rounded"
              style={{
                background: "transparent",
                color: dragHandleProps ? "rgba(16,24,32,0.4)" : "rgba(16,24,32,0.2)",
                cursor: dragHandleProps ? "grab" : "default",
                borderRadius: 999,
              }}
              onMouseEnter={(e) => {
                if (!dragHandleProps) return;
                (e.currentTarget as HTMLElement).style.background = "rgba(16,24,32,0.06)";
                (e.currentTarget as HTMLElement).style.color = "var(--st-ink)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = dragHandleProps ? "rgba(16,24,32,0.4)" : "rgba(16,24,32,0.2)";
              }}
              {...(dragHandleProps ?? {})}
            >
              <GripVertical size={14} />
            </button>

            {/* Move up */}
            {onMoveUp && (
              <button
                onClick={onMoveUp}
                className="w-7 h-7 flex items-center justify-center transition-colors"
                style={{ color: "rgba(16,24,32,0.4)", borderRadius: 999 }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(16,24,32,0.06)";
                  (e.currentTarget as HTMLElement).style.color = "var(--st-ink)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "rgba(16,24,32,0.4)";
                }}
                aria-label="Monter le bloc"
              >
                <ChevronUp size={14} />
              </button>
            )}

            {/* Move down */}
            {onMoveDown && (
              <button
                onClick={onMoveDown}
                className="w-7 h-7 flex items-center justify-center transition-colors"
                style={{ color: "rgba(16,24,32,0.4)", borderRadius: 999 }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(16,24,32,0.06)";
                  (e.currentTarget as HTMLElement).style.color = "var(--st-ink)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "rgba(16,24,32,0.4)";
                }}
                aria-label="Descendre le bloc"
              >
                <ChevronDown size={14} />
              </button>
            )}

            {/* Duplicate */}
            <button
              onClick={onDuplicate}
              className="w-7 h-7 flex items-center justify-center transition-colors"
              style={{ color: "rgba(16,24,32,0.4)", borderRadius: 999 }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(16,24,32,0.06)";
                (e.currentTarget as HTMLElement).style.color = "var(--st-ink)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = "rgba(16,24,32,0.4)";
              }}
              aria-label="Dupliquer le bloc"
            >
              <Copy size={14} />
            </button>

            {/* Delete */}
            <button
              onClick={onDelete}
              className="w-7 h-7 flex items-center justify-center transition-colors"
              style={{ color: "rgba(16,24,32,0.4)", borderRadius: 999 }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(220,38,38,0.08)";
                (e.currentTarget as HTMLElement).style.color = "#dc2626";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = "rgba(16,24,32,0.4)";
              }}
              aria-label="Supprimer le bloc"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}

        {children}
      </div>

      {/* Insert zone between blocks */}
      <div
        ref={insertBtnRef as React.RefObject<HTMLDivElement>}
        className="relative flex items-center justify-center py-1"
        style={{ opacity: hovered || insertOpen ? 1 : 0, transition: "opacity 150ms" }}
        onMouseEnter={() => setHovered(true)}
      >
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px" style={{ background: "rgba(16,24,32,0.08)" }} />
        <div className="relative z-10">
          <InsertButton onClick={() => setInsertOpen((v) => !v)} />
          {insertOpen && (
            <BuilderInsertMenu
              anchorRef={insertBtnRef as React.RefObject<HTMLElement>}
              onInsert={onInsertAfter}
              onClose={() => setInsertOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
