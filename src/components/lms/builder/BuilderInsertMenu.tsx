import { useRef, useState, useEffect } from "react";
import { Search, Plus } from "lucide-react";
import { LAYOUT_BLOCKS, CONTENT_BLOCKS } from "@/components/lms/blocks/registry";
import type { LessonBlockType } from "@/types/lms-blocks";

// Blocks shown as active in the insert menu (rest are grayed out as "coming soon")
const ACTIVE_CONTENT_TYPES: LessonBlockType[] = [
  "text",
  "key_points",
  "callout",
  "image",
  "video",
  "file",
  "quiz",
  "checklist",
  "bullet_list",
  "button",
  "exercise",
  "self_assessment",
  "work_deposit",
  "assignment",
  "table",
];

const ACTIVE_LAYOUT_TYPES: LessonBlockType[] = [
  "section",
  "row",
  "divider",
  "spacer",
  "container",
];

interface Props {
  onInsert: (type: LessonBlockType) => void;
  onClose: () => void;
  /** Anchor element for positioning — the "+" button */
  anchorRef: React.RefObject<HTMLElement>;
}

export default function BuilderInsertMenu({ onInsert, onClose, anchorRef }: Props) {
  const [search, setSearch] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !anchorRef.current?.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose, anchorRef]);

  const allContent = CONTENT_BLOCKS.map((b) => ({
    ...b,
    active: ACTIVE_CONTENT_TYPES.includes(b.type),
  }));
  const allLayout = LAYOUT_BLOCKS.map((b) => ({
    ...b,
    active: ACTIVE_LAYOUT_TYPES.includes(b.type),
  }));

  const q = search.toLowerCase();
  const filteredContent = allContent.filter((b) => b.label.toLowerCase().includes(q));
  const filteredLayout = allLayout.filter((b) => b.label.toLowerCase().includes(q));

  return (
    <div
      ref={menuRef}
      className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-2 w-80 overflow-hidden"
      style={{
        background: "var(--st-white)",
        borderRadius: "var(--st-radius-block)",
        boxShadow: "0 8px 32px rgba(16,24,32,0.14)",
        border: "1px solid rgba(16,24,32,0.09)",
        fontFamily: "inherit",
      }}
    >
      {/* Search */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 border-b"
        style={{ borderColor: "rgba(16,24,32,0.08)" }}
      >
        <Search size={13} style={{ color: "var(--st-ink-muted)" }} className="shrink-0" />
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un bloc…"
          className="flex-1 bg-transparent border-none outline-none text-sm"
          style={{ color: "var(--st-ink)", fontFamily: "inherit" }}
        />
      </div>

      <div className="max-h-72 overflow-y-auto py-2">
        {/* Content blocks */}
        {filteredContent.length > 0 && (
          <Section
            title="Contenu"
            items={filteredContent}
            onInsert={onInsert}
            onClose={onClose}
          />
        )}

        {/* Layout blocks */}
        {filteredLayout.length > 0 && (
          <Section
            title="Mise en page"
            items={filteredLayout}
            onInsert={onInsert}
            onClose={onClose}
          />
        )}

        {filteredContent.length === 0 && filteredLayout.length === 0 && (
          <p className="text-xs text-center py-6" style={{ color: "var(--st-ink-muted)" }}>
            Aucun bloc trouvé
          </p>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  items,
  onInsert,
  onClose,
}: {
  title: string;
  items: ReturnType<typeof CONTENT_BLOCKS.map<{ active: boolean; type: LessonBlockType; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }>>;
  onInsert: (type: LessonBlockType) => void;
  onClose: () => void;
}) {
  return (
    <div className="mb-1">
      <p
        className="px-4 py-1 text-xs font-semibold uppercase tracking-wider"
        style={{ color: "var(--st-ink-muted)" }}
      >
        {title}
      </p>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.type}
            disabled={!item.active}
            onClick={() => {
              if (item.active) {
                onInsert(item.type);
                onClose();
              }
            }}
            className="w-full flex items-center gap-3 px-4 py-2 text-left transition-colors"
            style={{
              fontFamily: "inherit",
              opacity: item.active ? 1 : 0.38,
              cursor: item.active ? "pointer" : "not-allowed",
            }}
            onMouseEnter={(e) => {
              if (item.active) (e.currentTarget as HTMLElement).style.background = "var(--st-yellow-soft)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <span
              className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0"
              style={{ background: "var(--st-surface)" }}
            >
              <Icon size={14} />
            </span>
            <span className="flex-1 text-sm" style={{ color: "var(--st-ink)" }}>
              {item.label}
            </span>
            {!item.active && (
              <span className="text-xs" style={{ color: "var(--st-ink-muted)" }}>
                Bientôt
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** The circular "+" button shown between blocks */
export function InsertButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center justify-center w-7 h-7 rounded-full border transition-all duration-150"
      style={{
        background: hovered ? "var(--st-yellow)" : "var(--st-white)",
        borderColor: hovered ? "var(--st-yellow)" : "rgba(16,24,32,0.18)",
        transform: hovered ? "scale(1.1)" : "scale(1)",
        boxShadow: hovered ? "0 2px 8px rgba(255,209,0,0.3)" : "none",
        fontFamily: "inherit",
      }}
      aria-label="Ajouter un bloc"
    >
      <Plus size={14} style={{ color: "var(--st-ink)" }} />
    </button>
  );
}
