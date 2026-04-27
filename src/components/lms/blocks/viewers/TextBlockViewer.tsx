import type { TextBlockContent } from "@/types/lms-blocks";

interface Props {
  content: TextBlockContent;
}

export default function TextBlockViewer({ content }: Props) {
  if (!content.html) return null;
  return (
    <div
      className="prose prose-sm sm:prose-base max-w-none prose-img:max-w-full prose-img:h-auto prose-img:rounded-lg"
      dangerouslySetInnerHTML={{ __html: content.html }}
    />
  );
}
