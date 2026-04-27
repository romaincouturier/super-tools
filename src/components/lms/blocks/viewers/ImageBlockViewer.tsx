import type { ImageBlockContent } from "@/types/lms-blocks";

interface Props {
  content: ImageBlockContent;
}

export default function ImageBlockViewer({ content }: Props) {
  if (!content.url) return null;
  return (
    <div className="space-y-3">
      <div className="rounded-lg overflow-hidden bg-muted border w-full">
        <img
          src={content.url}
          alt=""
          className="w-full h-auto object-contain max-h-[70vh]"
        />
      </div>
      {content.caption_html && (
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: content.caption_html }}
        />
      )}
    </div>
  );
}
