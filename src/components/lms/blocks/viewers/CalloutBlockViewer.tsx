import { cn } from "@/lib/utils";
import { CALLOUT_CLASSES } from "../callout-colors";
import type { CalloutBlockContent } from "@/types/lms-blocks";

interface Props {
  content: CalloutBlockContent;
}

export default function CalloutBlockViewer({ content }: Props) {
  if (!content.title && !content.body_html) return null;
  return (
    <div className={cn("rounded-lg border-l-4 px-4 py-3", CALLOUT_CLASSES[content.color] || CALLOUT_CLASSES.blue)}>
      {content.title && <p className="font-semibold mb-1 break-words">{content.title}</p>}
      {content.body_html && (
        <div
          className="prose prose-sm max-w-none break-words"
          dangerouslySetInnerHTML={{ __html: content.body_html }}
        />
      )}
    </div>
  );
}
