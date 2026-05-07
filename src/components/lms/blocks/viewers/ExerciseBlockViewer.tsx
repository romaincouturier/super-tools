import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronRight, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExerciseBlockContent } from "@/types/lms-blocks";
import ActionBlockShell from "./ActionBlockShell";

interface Props {
  content: ExerciseBlockContent;
}

export default function ExerciseBlockViewer({ content }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  if (!content.prompt_html && !content.answer_html && !content.checklist_items?.length) return null;

  const checklistItems = (content.checklist_items || []).filter((i) => i.label.trim());

  const toggle = (id: string) =>
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <ActionBlockShell icon={Pencil} label="Exercice">
      {content.prompt_html && (
        <div
          className="prose prose-sm max-w-none break-words"
          dangerouslySetInnerHTML={{ __html: content.prompt_html }}
        />
      )}

      {checklistItems.length > 0 && (
        <div className="mt-3 rounded-lg border bg-card px-4 py-3">
          {content.checklist_title && (
            <p className="font-semibold mb-2 text-sm break-words">{content.checklist_title}</p>
          )}
          <ul className="space-y-2">
            {checklistItems.map((item) => (
              <li key={item.id} className="flex items-start gap-2">
                <Checkbox
                  id={`ex-check-${item.id}`}
                  checked={!!checked[item.id]}
                  onCheckedChange={() => toggle(item.id)}
                  className="mt-0.5 shrink-0"
                />
                <label
                  htmlFor={`ex-check-${item.id}`}
                  className={cn(
                    "text-sm cursor-pointer flex-1 min-w-0 break-words",
                    checked[item.id] && "line-through text-muted-foreground",
                  )}
                >
                  {item.label}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {content.answer_html && (
        <div className="border-t pt-3 mt-3">
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
