import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SelfAssessmentBlockContent } from "@/types/lms-blocks";

interface Props {
  content: SelfAssessmentBlockContent;
}

/**
 * Self-assessment scale. Like the checklist, the learner's choice is held
 * in component state only; no server-side persistence in this stage.
 */
export default function SelfAssessmentBlockViewer({ content }: Props) {
  const [value, setValue] = useState<number | null>(null);
  const labels = (content.labels && content.labels.length > 0) ? content.labels : ["1", "2", "3", "4", "5"];

  return (
    <div className="rounded-lg border bg-card px-4 py-3 space-y-3">
      <p className="font-medium text-sm break-words">{content.prompt || "Comment évaluez-vous votre maîtrise ?"}</p>
      {content.scale === "stars" ? (
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setValue(n)}
              aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
              className="p-2 rounded hover:bg-muted transition-colors"
            >
              <Star
                className={cn(
                  "h-6 w-6 transition-colors",
                  value !== null && n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
                )}
              />
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {labels.map((label, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setValue(i)}
              className={cn(
                "px-3 py-2 rounded-md border text-sm transition-colors text-center break-words",
                value === i
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {value !== null && (
        <p className="text-xs text-muted-foreground italic">
          Merci pour votre retour. Cette information n'est pas enregistrée dans cette version.
        </p>
      )}
    </div>
  );
}
