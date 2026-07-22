import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LessonBlockType, RevealBlockContent } from "@/types/lms-blocks";

export interface RevealItem {
  id: string;
  type: LessonBlockType;
  element: ReactNode;
}

interface Props {
  content: RevealBlockContent;
  /** Children blocks (already rendered) that the learner reveals one at a time. */
  items: RevealItem[];
}

/**
 * Contextual button label for the next block to reveal (ST-2026-0247). Known
 * pedagogical blocks get an explicit call to action; everything else falls back
 * to the label configured on the block.
 */
const CONTEXTUAL_LABELS: Partial<Record<LessonBlockType, string>> = {
  key_points: "Voir les points clés",
  exercise: "Passer à l'exercice",
  self_assessment: "Passer à l'auto-évaluation",
  quiz: "Passer au quiz",
  assignment: "Passer au devoir",
  summary: "Voir le résumé",
  file: "Voir les ressources",
};

/**
 * Progressive-content container (ST-2026-0238, ST-2026-0247). Children stay
 * hidden and are revealed one block at a time. Each click reveals the next
 * block with a smooth grid-rows transition and updates the button label to
 * reflect the incoming content. The button disappears once everything is
 * revealed (unless the block is collapsible, in which case it toggles back).
 */
export default function RevealBlockViewer({ content, items }: Props) {
  const [revealedCount, setRevealedCount] = useState(0);

  const total = items.length;
  if (total === 0) return null;

  const collapsible = content.collapsible === true;
  const allRevealed = revealedCount >= total;
  const genericLabel = content.button_label || "Afficher la suite";
  const showButton = !allRevealed || collapsible;

  const nextItem = allRevealed ? null : items[revealedCount];
  const label = allRevealed
    ? "Masquer"
    : (nextItem && CONTEXTUAL_LABELS[nextItem.type]) || genericLabel;

  const handleClick = () => {
    if (allRevealed) {
      if (collapsible) setRevealedCount(0);
    } else {
      setRevealedCount((c) => Math.min(c + 1, total));
    }
  };

  return (
    <div>
      {items.map((item, i) => {
        const revealed = i < revealedCount;
        return (
          <div
            key={item.id}
            className={cn(
              "grid transition-[grid-template-rows,opacity] duration-500 ease-in-out",
              revealed ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
            )}
            aria-hidden={!revealed}
          >
            <div className="min-h-0 overflow-hidden">
              <div className={cn(revealed && "pb-6")}>{item.element}</div>
            </div>
          </div>
        );
      })}
      {showButton && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleClick}
            aria-expanded={revealedCount > 0}
            className="inline-flex items-center justify-center gap-2 whitespace-normal text-center font-semibold transition-all hover:-translate-y-px hover:shadow-lg"
            style={{
              background: "#FFD100",
              color: "#101820",
              borderRadius: 20,
              padding: "0.75rem 1.75rem",
              fontSize: "0.9375rem",
              boxShadow: "0 4px 12px rgba(255, 209, 0, 0.35)",
            }}
          >
            <span className="break-words">{label}</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 transition-transform duration-300",
                allRevealed && collapsible && "rotate-180",
              )}
            />
          </button>
        </div>
      )}
    </div>
  );
}
