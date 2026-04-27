import { Label } from "@/components/ui/label";
import RichTextEditor from "@/components/content/RichTextEditor";
import type { ExerciseBlockContent } from "@/types/lms-blocks";

interface Props {
  content: ExerciseBlockContent;
  onChange: (content: ExerciseBlockContent) => void;
}

export default function ExerciseBlockEditor({ content, onChange }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Énoncé de l'exercice</Label>
        <RichTextEditor
          content={content.prompt_html || ""}
          onChange={(prompt_html) => onChange({ ...content, prompt_html })}
          placeholder="Décrivez ce que l'apprenant doit faire…"
        />
      </div>
      <div>
        <Label>Corrigé (optionnel)</Label>
        <RichTextEditor
          content={content.answer_html || ""}
          onChange={(answer_html) => onChange({ ...content, answer_html })}
          placeholder="Le corrigé est masqué par défaut, l'apprenant le révèle d'un clic."
        />
      </div>
    </div>
  );
}
