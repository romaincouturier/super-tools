import type { TextBlockContent } from "@/types/lms-blocks";

interface Props {
  content: TextBlockContent;
}

export default function TextBlockViewer({ content }: Props) {
  if (!content.html) return null;
  return (
    <div
      className="prose prose-base sm:prose-lg max-w-[720px] prose-headings:font-bold prose-headings:text-foreground prose-p:text-foreground prose-img:max-w-full prose-img:h-auto prose-img:rounded-lg break-words"
      dangerouslySetInnerHTML={{ __html: content.html }}
    />
  );
}
