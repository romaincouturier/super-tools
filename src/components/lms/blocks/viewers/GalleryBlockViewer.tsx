import DOMPurify from "dompurify";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { GalleryBlockContent } from "@/types/lms-blocks";

interface Props {
  content: GalleryBlockContent;
}

export default function GalleryBlockViewer({ content }: Props) {
  const images = (content.images ?? []).filter((img) => img.url);
  if (images.length === 0) return null;

  if (content.mode === "carousel") {
    return <CarouselView images={images} />;
  }

  const columns = content.columns ?? 3;
  const colStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gap: "0.75rem",
  };

  return (
    <div style={colStyle}>
      {images.map((img, idx) => (
        <div key={idx} className="rounded-lg overflow-hidden bg-muted">
          <img
            src={img.url!}
            alt=""
            className="w-full h-full object-cover aspect-square"
          />
          {img.caption_html && (
            <div
              className="px-2 py-1 text-xs text-center"
              style={{ color: "var(--st-ink-60)" }}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(img.caption_html) }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function CarouselView({ images }: { images: { url: string | null; caption_html?: string | null }[] }) {
  const [current, setCurrent] = useState(0);
  const prev = () => setCurrent((c) => (c - 1 + images.length) % images.length);
  const next = () => setCurrent((c) => (c + 1) % images.length);

  return (
    <div className="relative select-none">
      <div className="rounded-xl overflow-hidden bg-muted aspect-video relative">
        <img
          src={images[current].url!}
          alt=""
          className="w-full h-full object-contain"
        />

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full"
              style={{ background: "rgba(16,24,32,0.5)", color: "#fff" }}
              aria-label="Image précédente"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full"
              style={{ background: "rgba(16,24,32,0.5)", color: "#fff" }}
              aria-label="Image suivante"
            >
              <ChevronRight size={18} />
            </button>
            <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
              {images.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrent(idx)}
                  className="w-2 h-2 rounded-full transition-colors"
                  style={{
                    background: idx === current ? "#fff" : "rgba(255,255,255,0.4)",
                  }}
                  aria-label={`Image ${idx + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {images[current].caption_html && (
        <div
          className="mt-2 text-sm text-center"
          style={{ color: "var(--st-ink-60)" }}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(images[current].caption_html!) }}
        />
      )}

      {images.length > 1 && (
        <p className="mt-1 text-xs text-center" style={{ color: "var(--st-ink-50)" }}>
          {current + 1} / {images.length}
        </p>
      )}
    </div>
  );
}
