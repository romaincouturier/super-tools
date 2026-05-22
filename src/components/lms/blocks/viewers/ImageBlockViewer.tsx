import type { ImageBlockContent } from "@/types/lms-blocks";
import { ImageWithLightbox } from "./ImageLightbox";

interface Props {
  content: ImageBlockContent;
}

export default function ImageBlockViewer({ content }: Props) {
  if (!content.url) return null;
  return (
    <div className="space-y-3">
      <ImageWithLightbox
        src={content.url}
        alt=""
        imgStyle={{ maxHeight: "70vh" }}
      />
      {content.caption_html && (
        <div
          className="prose prose-sm max-w-none break-words"
          dangerouslySetInnerHTML={{ __html: content.caption_html }}
        />
      )}
    </div>
  );
}
