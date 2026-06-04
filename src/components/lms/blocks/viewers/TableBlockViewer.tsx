import DOMPurify from "dompurify";
import type { TableBlockContent } from "@/types/lms-blocks";

interface Props {
  content: TableBlockContent;
}

export default function TableBlockViewer({ content }: Props) {
  if (!content.html) return null;
  return (
    <div
      className="prose prose-base max-w-[720px] [&_table]:border-collapse [&_table]:w-full [&_table]:text-sm [&_th]:border [&_th]:border-muted-foreground/30 [&_th]:bg-muted/50 [&_th]:font-semibold [&_th]:p-2 [&_th]:text-left [&_td]:border [&_td]:border-muted-foreground/30 [&_td]:p-2 [&_td]:align-top"
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content.html) }}
    />
  );
}
