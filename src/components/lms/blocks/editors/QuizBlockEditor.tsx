import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCourseQuizzes } from "@/hooks/useLms";
import type { QuizBlockContent } from "@/types/lms-blocks";

interface Props {
  courseId: string | undefined;
  content: QuizBlockContent;
  onChange: (content: QuizBlockContent) => void;
}

export default function QuizBlockEditor({ courseId, content, onChange }: Props) {
  const { data: quizzes = [], isLoading } = useCourseQuizzes(courseId);

  if (!courseId) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Le contexte du cours est introuvable. Rafraîchissez la page.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="h-3.5 w-3.5" /> Chargement des quiz…
      </div>
    );
  }

  if (quizzes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Aucun quiz dans ce cours pour le moment. Créez-en un d'abord depuis le builder de cours.
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
            <SelectItem key={q.id} value={q.id}>
              {q.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Le quiz s'affichera ici dans la leçon, avec les questions définies dans le builder.
      </p>
    </div>
  );
}
