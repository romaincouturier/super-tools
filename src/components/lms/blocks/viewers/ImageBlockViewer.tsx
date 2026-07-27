import { useContext } from "react";
import DOMPurify from "dompurify";
import { cn } from "@/lib/utils";
import type { ImageBlockContent, RowImageFrame } from "@/types/lms-blocks";
import { ImageWithLightbox } from "./ImageLightbox";
import { RowMediaContext } from "./rowMediaContext";

interface Props {
  content: ImageBlockContent;
}

const FRAME_CLASSES: Record<RowImageFrame, string> = {
  none: "",
  card: "bg-white p-2 rounded-lg border border-black/5 shadow-sm",
  border: "border rounded-md overflow-hidden",
  rounded: "rounded-lg overflow-hidden",
  shadow: "rounded-md overflow-hidden shadow-md",
};

export default function ImageBlockViewer({ content }: Props) {
  const media = useContext(RowMediaContext);
  if (!content.url) return null;

  const caption = content.caption_html ? (
    <div
      className="prose prose-sm max-w-none break-words"
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content.caption_html) }}
    />
  ) : null;

  // Hors d'un bloc colonnes : rendu historique (taille naturelle plafonnée)
  if (!media) {
    return (
      <div className="space-y-3">
        <ImageWithLightbox src={content.url} alt="" imgStyle={{ maxHeight: "70vh" }} />
        {caption}
      </div>
    );
  }

  // Rendu harmonisé dans un bloc colonnes (ST-2026-0250) : les images des
  // colonnes partagent cadre, ajustement et alignement, sans déformation.
  const fixedHeight = media.fit === "cover" || media.sizing === "equal_height";
  const alignItems =
    media.verticalAlign === "center"
      ? "items-center"
      : media.verticalAlign === "bottom"
        ? "items-end"
        : "items-start";

  const zoneClass = cn(
    "flex w-full justify-center",
    alignItems,
    fixedHeight && "h-56 sm:h-64 md:h-72",
    FRAME_CLASSES[media.frame],
  );

  let buttonClass = "w-full";
  let imgClass = "block w-full h-auto object-contain";
  if (fixedHeight) {
    buttonClass = "w-full h-full";
    imgClass = cn(
      "block w-full h-full",
      media.fit === "cover" ? "object-cover" : "object-contain",
    );
  } else if (media.fit === "natural") {
    buttonClass = "max-w-full";
    imgClass = cn("block max-w-full h-auto", media.sizing === "max_height" && "max-h-[22rem]");
  } else if (media.sizing === "max_height") {
    imgClass = "block w-full max-h-[22rem] object-contain";
  }

  return (
    <div className="space-y-3">
      <div className={zoneClass}>
        <ImageWithLightbox src={content.url} alt="" className={buttonClass} imgClassName={imgClass} />
      </div>
      {caption}
    </div>
  );
}
