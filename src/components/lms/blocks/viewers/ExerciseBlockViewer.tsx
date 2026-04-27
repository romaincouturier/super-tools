import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Pencil } from "lucide-react";
import type { ExerciseBlockContent } from "@/types/lms-blocks";

interface Props {
  content: ExerciseBlockContent;
}

export default function ExerciseBlockViewer({ content }: Props) {
  const [revealed, setRevealed] = useState(false);
  if (!content.prompt_html && !content.answer_html) return null;
  return (
    <div className="rounded-lg border bg-card px-4 py-3 space-y-3">
      <div className="flex items-center gap-2 text-foreground">
        <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="font-semibold">Exercice</p>
      </div>
      {content.prompt_html && (
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: content.prompt_html }}
        />
      )}
      {content.answer_html && (
        <div className="border-t pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRevealed((v) => !v)}
            aria-expanded={revealed}
          >
            {revealed ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
            {revealed ? "Masquer le corrigé" : "Voir le corrigé"}
          </Button>
          {revealed && (
            <div
              className="prose prose-sm max-w-none mt-2"
              dangerouslySetInnerHTML={{ __html: content.answer_html }}
            />
          )}
        </div>
      )}
    </div>
  );
}
