import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Pencil } from "lucide-react";
import type { ExerciseBlockContent } from "@/types/lms-blocks";
import ActionBlockShell from "./ActionBlockShell";

interface Props {
  content: ExerciseBlockContent;
}

export default function ExerciseBlockViewer({ content }: Props) {
  const [revealed, setRevealed] = useState(false);
  if (!content.prompt_html && !content.answer_html) return null;
  return (
    <ActionBlockShell icon={Pencil} label="Exercice">
      {content.prompt_html && (
        <div
          className="prose prose-sm max-w-none break-words"
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
              className="prose prose-sm max-w-none mt-2 break-words"
              dangerouslySetInnerHTML={{ __html: content.answer_html }}
            />
          )}
        </div>
      )}
    </ActionBlockShell>
  );
}
