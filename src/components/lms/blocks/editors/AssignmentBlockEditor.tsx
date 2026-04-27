import { Label } from "@/components/ui/label";
import RichTextEditor from "@/components/content/RichTextEditor";
import type { AssignmentBlockContent } from "@/types/lms-blocks";

interface Props {
  content: AssignmentBlockContent;
  onChange: (content: AssignmentBlockContent) => void;
}

export default function AssignmentBlockEditor({ content, onChange }: Props) {
  return (
    <div className="space-y-2">
      <Label>Instructions du devoir</Label>
      <RichTextEditor
        content={content.instructions_html || ""}
        onChange={(instructions_html) => onChange({ ...content, instructions_html })}
        placeholder="Décrivez ce qui est attendu, les critères, le format de remise…"
      />
      <p className="text-xs text-muted-foreground">
        L'apprenant verra ces instructions puis le formulaire de dépôt de fichier.
      </p>
    </div>
  );
}
