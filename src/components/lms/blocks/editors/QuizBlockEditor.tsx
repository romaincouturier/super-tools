import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HelpCircle } from "lucide-react";
import { useCourseQuizzes } from "@/hooks/useLms";
import type { QuizBlockContent } from "@/types/lms-blocks";

interface Props {
  courseId: string | undefined;
  content: QuizBlockContent;
  onChange: (content: QuizBlockContent) => void;
  slim?: boolean;
}

export default function QuizBlockEditor({ courseId, content, onChange, slim }: Props) {
  const { data: quizzes = [], isLoading } = useCourseQuizzes(courseId);

  if (!courseId) {
    return <p className="text-sm text-muted-foreground italic">Contexte du cours introuvable.</p>;
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="h-3.5 w-3.5" /> Chargement…
      </div>
    );
  }

  if (slim) {
    const selected = quizzes.find((q) => q.id === content.quiz_id);
    return (
      <div
        className="flex items-center gap-3 rounded-xl px-4 py-3"
        style={{ background: "var(--st-surface)", border: "1px solid var(--st-ink-08)" }}
      >
        <HelpCircle size={20} style={{ color: "var(--st-ink-50)", flexShrink: 0 }} />
        <div className="flex-1 min-w-0">
          {selected ? (
            <p className="text-sm font-medium truncate" style={{ color: "var(--st-ink)" }}>
              {selected.title}
            </p>
          ) : (
            <Select
              value={content.quiz_id || ""}
              onValueChange={(v) => onChange({ ...content, quiz_id: v || null })}
            >
              <SelectTrigger className="h-8 text-sm border-dashed">
                <SelectValue placeholder={quizzes.length === 0 ? "Aucun quiz disponible" : "Associer un quiz…"} />
              </SelectTrigger>
              <SelectContent>
                {quizzes.map((q) => (
                  <SelectItem key={q.id} value={q.id}>{q.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {selected && (
          <button
            className="text-xs shrink-0 underline"
            style={{ color: "var(--st-ink-50)" }}
            onClick={() => onChange({ ...content, quiz_id: null })}
          >
            Changer
          </button>
        )}
      </div>
    );
  }

  if (quizzes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Aucun quiz dans ce cours. Créez-en un d'abord depuis la liste des cours.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Quiz à associer</Label>
      <Select
        value={content.quiz_id || ""}
        onValueChange={(value) => onChange({ ...content, quiz_id: value || null })}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Sélectionner un quiz…" />
        </SelectTrigger>
        <SelectContent>
          {quizzes.map((q) => (
            <SelectItem key={q.id} value={q.id}>{q.title}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Le quiz s'affichera ici dans la leçon avec les questions définies.
      </p>
    </div>
  );
}
