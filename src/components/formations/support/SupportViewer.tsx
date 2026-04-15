import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { Loader2, BookOpen, Download, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { downloadFile } from "@/lib/file-utils";
import { toast } from "sonner";
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

/** Lazy image: only loads src when scrolled into view */
const LazyImage = ({ src, alt, className, style, onClick }: {
  src: string; alt: string; className?: string; style?: React.CSSProperties; onClick?: () => void;
}) => {
  const { ref, visible } = useLazyVisible("100px");
  return (
    <div ref={ref} className={className} style={style}>
      {visible ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-full rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
          onClick={onClick}
        />
      ) : (
        <div className="w-full h-full rounded-lg bg-muted animate-pulse" />
      )}
    </div>
  );
};

/** Lightbox for viewing images full-screen with navigation and download */
const SupportImageLightbox = ({ images, currentIndex, onClose, onNavigate }: {
  images: SupportMedia[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) => {
  const item = images[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowLeft" && hasPrev) onNavigate(currentIndex - 1);
    if (e.key === "ArrowRight" && hasNext) onNavigate(currentIndex + 1);
  }, [onClose, hasPrev, hasNext, currentIndex, onNavigate]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleDownload = async () => {
    try {
      await downloadFile(item.file_url, item.file_name);
    } catch {
      toast.error("Erreur lors du téléchargement");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={onClose}>
      {/* Top bar */}
      <div className="absolute top-4 right-4 flex gap-2 z-10">
        <Button variant="ghost" size="icon" className="h-10 w-10 text-white hover:bg-white/20"
          onClick={(e) => { e.stopPropagation(); handleDownload(); }}>
          <Download className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-10 w-10 text-white hover:bg-white/20" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Navigation */}
      {hasPrev && (
        <Button variant="ghost" size="icon"
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-10 h-12 w-12"
          onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex - 1); }}>
          <ChevronLeft className="h-8 w-8" />
        </Button>
      )}
      {hasNext && (
        <Button variant="ghost" size="icon"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-10 h-12 w-12"
          onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex + 1); }}>
          <ChevronRight className="h-8 w-8" />
        </Button>
      )}

      {/* Image */}
      <img
        src={item.file_url}
        alt={item.file_name}
        className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Counter */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg">
        <span className="text-white text-sm truncate max-w-[200px]">{item.file_name}</span>
        <span className="text-white/40 text-xs">{currentIndex + 1} / {images.length}</span>
      </div>
    </div>
  );
};

interface SupportViewerProps {
  trainingId: string;
  allowUnpublished?: boolean;
  showUnavailableState?: boolean;
  colors?: {
    primary: string;
    onPrimary: string;
    surface: string;
    onSurface: string;
    surfaceContainerLowest: string;
    outlineVariant: string;
  };
}

const SupportViewer = ({ trainingId, allowUnpublished = false, showUnavailableState = false, colors }: SupportViewerProps) => {
  const { data: support, isLoading } = useTrainingSupport(trainingId);
  const { data: sections = [] } = useSupportSections(support?.id);
  const { data: allMedia = [] } = useSectionMedia(support?.id);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

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

  // Collect ALL images across all sections for lightbox navigation
  const allImages = useMemo(() => {
    const imgs: SupportMedia[] = [];
    sortedSections.forEach((s) => {
      (mediaBySection[s.id] || []).forEach((m) => {
        if (m.file_type === "image") imgs.push(m);
      });
    });
    return imgs;
  }, [sortedSections, mediaBySection]);

  const openLightbox = useCallback((media: SupportMedia) => {
    const idx = allImages.findIndex((m) => m.id === media.id);
    if (idx >= 0) setLightboxIndex(idx);
  }, [allImages]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!support) {
    return showUnavailableState ? (
      <SupportUnavailableState title="Support indisponible" description="Aucun support n'est encore disponible pour cette formation." />
    ) : null;
  }

  if (!allowUnpublished && !support.is_published) {
    return showUnavailableState ? (
      <SupportUnavailableState title="Support non publié" description="Le support existe, mais il n'est pas encore publié pour les participants." />
    ) : null;
  }

  if (sortedSections.length === 0) {
    return showUnavailableState ? (
      <SupportUnavailableState title="Support vide" description="Le support est prêt, mais il ne contient encore aucune section." />
    ) : null;
  }

  const c = colors;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <BookOpen className="h-8 w-8 mx-auto mb-2" style={c ? { color: c.primary } : undefined} />
        <h2 className="text-xl font-bold" style={c ? { color: c.onSurface } : undefined}>
          {support.title}
        </h2>
      </div>

      {sortedSections.map((section, idx) => (
        <LazySection
          key={section.id}
          section={section}
          idx={idx}
          media={mediaBySection[section.id] || []}
          colors={c}
          onImageClick={openLightbox}
        />
      ))}

      {lightboxIndex !== null && (
        <SupportImageLightbox
          images={allImages}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  );
};

const SupportUnavailableState = ({ title, description }: { title: string; description: string }) => (
  <section className="rounded-xl p-6 border text-center" style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
    <BookOpen className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
    <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
    <p className="text-sm text-muted-foreground">{description}</p>
  </section>
);

const LazySection = ({
  section, idx, media, colors: c, onImageClick,
}: {
  section: SupportSection;
  idx: number;
  media: SupportMedia[];
  colors?: SupportViewerProps["colors"];
  onImageClick: (m: SupportMedia) => void;
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
      <h3 className="text-lg font-semibold flex items-center gap-2" style={c ? { color: c.onSurface } : undefined}>
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
          {/* Images — each lazy-loaded individually */}
          {images.length > 0 && (
            <div className={`grid gap-2 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3"}`}>
              {images.map((m) => (
                <LazyImage
                  key={m.id}
                  src={m.file_url}
                  alt={m.file_name}
                  className="rounded-lg overflow-hidden"
                  style={{ height: images.length === 1 ? "300px" : "160px" }}
                  onClick={() => onImageClick(m)}
                />
              ))}
            </div>
          )}

          {/* Videos — compact */}
          {videos.map((m) => (
            <video
              key={m.id}
              controls
              className="w-full max-w-md rounded-lg"
              preload="metadata"
              muted
              playsInline
              src={`${m.file_url}#t=0.1`}
            >
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
        images.length + videos.length + audios.length > 0 && (
          <div className="h-32 flex items-center justify-center">
            <Spinner className="text-muted-foreground" />
          </div>
        )
      )}

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
