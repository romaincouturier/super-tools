import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HelpCircle, Plus } from "lucide-react";
import { useCourseQuizzes, useCreateQuiz } from "@/hooks/useLms";
import { useToast } from "@/hooks/use-toast";
import type { QuizBlockContent } from "@/types/lms-blocks";

interface Props {
  courseId: string | undefined;
  lessonId: string | undefined;
  content: QuizBlockContent;
  onChange: (content: QuizBlockContent) => void;
  slim?: boolean;
}

export default function QuizBlockEditor({ courseId, lessonId, content, onChange, slim }: Props) {
  const { data: quizzes = [], isLoading } = useCourseQuizzes(courseId);
  const createQuiz = useCreateQuiz();
  const { toast } = useToast();

  const handleCreateQuiz = async () => {
    if (!courseId) return;
    try {
      const q = await createQuiz.mutateAsync({ course_id: courseId, title: "Nouveau quiz" });
      onChange({ ...content, quiz_id: q.id });
      toast({ title: "Quiz créé" });
    } catch (err) {
      toast({
        title: "Erreur lors de la création du quiz",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  };

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
          ) : quizzes.length === 0 ? (
            <button
              onClick={handleCreateQuiz}
              disabled={createQuiz.isPending || !courseId}
              className="text-sm font-medium"
              style={{ color: "var(--st-ink-50)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              {createQuiz.isPending ? "Création…" : "+ Créer un quiz"}
            </button>
          ) : (
            <Select
              value={content.quiz_id || ""}
              onValueChange={(v) => onChange({ ...content, quiz_id: v || null })}
            >
              <SelectTrigger className="h-8 text-sm border-dashed">
                <SelectValue placeholder="Associer un quiz…" />
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
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground italic">Aucun quiz dans ce cours.</p>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCreateQuiz}
          disabled={createQuiz.isPending || !courseId}
          className="gap-1.5"
        >
          {createQuiz.isPending ? <Spinner className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {createQuiz.isPending ? "Création…" : "Créer un quiz"}
        </Button>
      </div>
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
