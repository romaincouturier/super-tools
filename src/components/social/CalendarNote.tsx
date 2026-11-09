import { useDraggable } from "@dnd-kit/core";
import { StickyNote } from "lucide-react";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { maskText } from "@/lib/demoMask";
import { cn } from "@/lib/utils";
import type { SocialCalendarNote } from "@/services/socialContents";

export const NOTE_DRAG_PREFIX = "note:";

interface CalendarNoteProps {
  note: SocialCalendarNote;
  onOpen: (note: SocialCalendarNote) => void;
}

/** Note du calendrier : fond teinté de sa couleur, icône de note, ni statut ni canal. Glissable sur un autre jour. */
export default function CalendarNote({ note, onOpen }: CalendarNoteProps) {
  const { isDemoMode } = useDemoMode();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `${NOTE_DRAG_PREFIX}${note.id}`, data: { note } });
  const text = isDemoMode ? maskText(note.text) : note.text;
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-label={`Note : ${text}`}
      data-testid={`social-note-${note.id}`}
      style={{ backgroundColor: `${note.color}26`, borderColor: note.color }}
      onClick={() => onOpen(note)}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(note);
        }
      }}
      className={cn(
        "flex items-start gap-1 rounded border border-dashed px-1.5 py-0.5 text-xs cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50",
      )}
    >
      <StickyNote className="h-3 w-3 mt-0.5 shrink-0" style={{ color: note.color }} aria-hidden="true" />
      <span className="line-clamp-2 break-words min-w-0">{text}</span>
    </div>
  );
}
