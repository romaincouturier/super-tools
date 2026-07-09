import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RevealBlockContent } from "@/types/lms-blocks";

interface Props {
  content: RevealBlockContent;
  /** Children blocks rendered by the parent player. */
  children?: ReactNode;
}

/**
 * Progressive-content container (ST-2026-0238). Children stay hidden until
 * the learner clicks the button. The reveal animates via grid-template-rows
 * so the layout expands smoothly instead of jumping.
 */
export default function RevealBlockViewer({ content, children }: Props) {
  const [revealed, setRevealed] = useState(false);
  const label = content.button_label || "Révéler la suite";
  const collapsible = content.collapsible === true;
  const hideAfterClick = content.hide_button_after_click === true;
  const showButton = !revealed || !hideAfterClick;
  const interactive = !revealed || collapsible;

  return (
    <div>
      {showButton && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => {
              if (interactive) setRevealed((v) => !v);
            }}
            disabled={!interactive}
            aria-expanded={revealed}
            className={cn(
              "inline-flex items-center justify-center gap-2 whitespace-normal text-center font-semibold transition-all",
              interactive ? "hover:-translate-y-px hover:shadow-lg" : "cursor-default",
            )}
            style={{
              background: "#FFD100",
              color: "#101820",
              borderRadius: 20,
              padding: "0.75rem 1.75rem",
              fontSize: "0.9375rem",
              boxShadow: "0 4px 12px rgba(255, 209, 0, 0.35)",
            }}
          >
            <span className="break-words">{revealed && collapsible ? "Masquer" : label}</span>
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 transition-transform duration-300", revealed && "rotate-180")}
            />
          </button>
        </div>
      )}
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-500 ease-in-out",
          revealed ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
        aria-hidden={!revealed}
      >
        <div className="min-h-0 overflow-hidden">
          <div className={cn("space-y-6", showButton && "pt-6")}>{children}</div>
        </div>
      </div>
    </div>
  );
}
