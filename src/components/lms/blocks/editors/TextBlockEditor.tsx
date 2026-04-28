import RichTextEditor from "@/components/content/RichTextEditor";
import type { TextBlockContent } from "@/types/lms-blocks";

interface Props {
  content: TextBlockContent;
  onChange: (content: TextBlockContent) => void;
}

export default function TextBlockEditor({ content, onChange }: Props) {
  return (
    <RichTextEditor
      content={content.html || ""}
      onChange={(html) => onChange({ html })}
      placeholder="Saisissez votre contenu…"
    />
  );
}
