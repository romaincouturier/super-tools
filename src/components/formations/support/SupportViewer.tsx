import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { Loader2, BookOpen, Image, Video, Mic, ExternalLink } from "lucide-react";
import {
  useTrainingSupport, useSupportSections, useSectionMedia,
} from "@/hooks/useTrainingSupport";
import type { SupportSection, SupportMedia } from "@/hooks/useTrainingSupport";

/** Hook that returns true once the element has entered the viewport */
const useLazyVisible = (rootMargin = "200px") => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return { ref, visible };
};

interface SupportViewerProps {
  trainingId: string;
  colors?: {
    primary: string;
    onPrimary: string;
    surface: string;
    onSurface: string;
    surfaceContainerLowest: string;
    outlineVariant: string;
  };
}

/**
 * Read-only viewer for training support materials.
 * Used in TrainingSummary and LearnerPortal.
 */
const SupportViewer = ({ trainingId, colors }: SupportViewerProps) => {
  const { data: support, isLoading } = useTrainingSupport(trainingId);
  const { data: sections = [] } = useSupportSections(support?.id);
  const { data: allMedia = [] } = useSectionMedia(support?.id);

  const sortedSections = useMemo(() => {
    return [...sections].sort((a, b) => {
      if (a.is_resources && !b.is_resources) return 1;
      if (!a.is_resources && b.is_resources) return -1;
      return a.position - b.position;
    });
  }, [sections]);

  const mediaBySection = useMemo(() => {
    const map: Record<string, SupportMedia[]> = {};
    allMedia.forEach((m) => {
      if (!map[m.section_id]) map[m.section_id] = [];
      map[m.section_id].push(m);
    });
    return map;
  }, [allMedia]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!support || !support.is_published || sortedSections.length === 0) {
    return null;
  }

  const c = colors;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="text-center">
        <BookOpen className="h-8 w-8 mx-auto mb-2" style={c ? { color: c.primary } : undefined} />
        <h2 className="text-xl font-bold" style={c ? { color: c.onSurface } : undefined}>
          {support.title}
        </h2>
      </div>

      {/* Sections */}
      {sortedSections.map((section, idx) => (
          <LazySection
            key={section.id}
            section={section}
            idx={idx}
            media={mediaBySection[section.id] || []}
            colors={c}
          />
        ))}
    </div>
  );
};

/** Each section only renders its heavy media once it scrolls into view */
const LazySection = ({
  section, idx, media, colors: c,
}: {
  section: SupportSection;
  idx: number;
  media: SupportMedia[];
  colors?: SupportViewerProps["colors"];
}) => {
  const { ref, visible } = useLazyVisible("300px");
  const images = media.filter((m) => m.file_type === "image");
  const videos = media.filter((m) => m.file_type === "video");
  const audios = media.filter((m) => m.file_type === "audio");

  return (
    <section
      ref={ref}
      className="rounded-xl p-4 space-y-3"
      style={c ? {
        background: c.surfaceContainerLowest,
        border: `1px solid ${c.outlineVariant}30`,
      } : {
        background: "var(--card)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Section title */}
      <h3
        className="text-lg font-semibold flex items-center gap-2"
        style={c ? { color: c.onSurface } : undefined}
      >
        {section.is_resources ? (
          <BookOpen className="h-5 w-5" style={c ? { color: c.primary } : undefined} />
        ) : (
          <span
            className="text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0"
            style={c ? { background: c.primary, color: c.onPrimary } : {
              background: "var(--primary)",
              color: "var(--primary-foreground)",
            }}
          >
            {idx + 1}
          </span>
        )}
        {section.title}
      </h3>

      {visible ? (
        <>
          {/* Images */}
          {images.length > 0 && (
            <div className={`grid gap-2 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
              {images.map((m) => (
                <img
                  key={m.id}
                  src={m.file_url}
                  alt={m.file_name}
                  className="w-full rounded-lg object-cover"
                  loading="lazy"
                  style={{ maxHeight: images.length === 1 ? "400px" : "200px" }}
                />
              ))}
            </div>
          )}

          {/* Videos */}
          {videos.map((m) => (
            <video key={m.id} controls className="w-full rounded-lg" preload="metadata">
              <source src={m.file_url} type={m.mime_type || "video/mp4"} />
            </video>
          ))}

          {/* Audio */}
          {audios.map((m) => (
            <div key={m.id} className="space-y-1">
              <audio controls className="w-full" preload="metadata">
                <source src={m.file_url} type={m.mime_type || "audio/mpeg"} />
              </audio>
              {m.transcript_summary && (
                <p className="text-sm italic" style={c ? { color: c.onSurface + "cc" } : undefined}>
                  {m.transcript_summary}
                </p>
              )}
            </div>
          ))}
        </>
      ) : (
        /* Placeholder while not yet visible */
        images.length + videos.length + audios.length > 0 && (
          <div className="h-32 flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )
      )}

      {/* Content (HTML) — always rendered (lightweight) */}
      {section.content && (
        <div
          className="prose prose-sm dark:prose-invert max-w-none"
          style={c ? { color: c.onSurface } : undefined}
          dangerouslySetInnerHTML={{ __html: section.content }}
        />
      )}
    </section>
  );
};

export default SupportViewer;
