import type { TextBlockContent } from "@/types/lms-blocks";

interface Props {
  content: TextBlockContent;
}

export default function TextBlockViewer({ content }: Props) {
  if (!content.html) return null;
  return (
    <div
      className="prose prose-base sm:prose-lg max-w-[800px] prose-headings:font-bold prose-headings:text-foreground prose-p:text-foreground prose-img:max-w-full prose-img:h-auto prose-img:rounded-lg break-words [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5"
      dangerouslySetInnerHTML={{ __html: content.html }}
    />
  );
}
