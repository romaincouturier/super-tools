import { useRef, useState } from "react";
import { Trash2, GripVertical, Copy } from "lucide-react";
import { InsertButton } from "./BuilderInsertMenu";
import BuilderInsertMenu from "./BuilderInsertMenu";
import type { LessonBlockType } from "@/types/lms-blocks";

interface Props {
  blockRadius: number;
  density: "compact" | "normal" | "spacious";
  onDelete: () => void;
  onDuplicate: () => void;
  onInsertAfter: (type: LessonBlockType) => void;
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
            {/* Grip — disabled, tooltip */}
            <div className="relative group/grip">
              <button
                disabled
                className="w-7 h-7 flex items-center justify-center rounded-lg cursor-not-allowed"
                style={{ background: "transparent", color: "rgba(16,24,32,0.25)" }}
                aria-label="Déplacer le bloc"
              >
                <GripVertical size={14} />
              </button>
              <span
                className="absolute right-0 top-8 whitespace-nowrap text-xs px-2 py-1 rounded-lg opacity-0 group-hover/grip:opacity-100 pointer-events-none transition-opacity z-20"
                style={{ background: "var(--st-ink)", color: "#fff", fontFamily: "inherit" }}
              >
                Déplacement bientôt dispo
              </span>
            </div>

            {/* Duplicate */}
            <button
              onClick={onDuplicate}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: "rgba(16,24,32,0.4)" }}
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
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: "rgba(16,24,32,0.4)" }}
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
