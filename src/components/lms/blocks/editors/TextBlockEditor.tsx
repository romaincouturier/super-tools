import { useCallback } from "react";
import RichTextEditor from "@/components/content/RichTextEditor";
import { uploadLmsImage } from "@/hooks/useLmsUploads";
import type { TextBlockContent } from "@/types/lms-blocks";

interface Props {
  content: TextBlockContent;
  onChange: (content: TextBlockContent) => void;
  lessonId?: string;
  slim?: boolean;
}

export default function TextBlockEditor({ content, onChange, lessonId }: Props) {
  const handleImagePaste = useCallback(
    lessonId
      ? (file: File) => uploadLmsImage(file, lessonId)
      : undefined,
    [lessonId],
  );

  return (
    <RichTextEditor
      content={content.html || ""}
      onChange={(html) => onChange({ html })}
      placeholder="Saisissez votre contenu…"
      onImagePaste={handleImagePaste}
    />
  );
}
