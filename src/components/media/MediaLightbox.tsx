import { MediaItem } from "@/hooks/useMedia";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface MediaLightboxProps {
  item: MediaItem;
  items: MediaItem[];
  onClose: () => void;
  onNavigate: (item: MediaItem) => void;
  /** Conservé pour compatibilité d'appel ; l'action livrable se fait depuis la grille. */
  onToggleDeliverable?: (item: MediaItem) => void;
  autoFullscreen?: boolean;
}

const slideVariants = {
  enter: (dir: number) => ({ x: dir >= 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir >= 0 ? "-100%" : "100%", opacity: 0 }),
};

const MediaLightbox = ({ item, items, onClose, onNavigate, autoFullscreen }: MediaLightboxProps) => {
  const currentIndex = items.findIndex((i) => i.id === item.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < items.length - 1;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    const handleFSChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFSChange);
    return () => document.removeEventListener("fullscreenchange", handleFSChange);
  }, []);

  useEffect(() => {
    if (autoFullscreen) {
      try {
        const el = containerRef.current as any;
        const req = el?.requestFullscreen || el?.webkitRequestFullscreen;
        req?.call(el)?.catch?.(() => {});
      } catch {
        // Fullscreen not supported (iOS Safari/Brave)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      const el = containerRef.current as any;
      if (!document.fullscreenElement) {
        const req = el?.requestFullscreen || el?.webkitRequestFullscreen;
        if (req) await req.call(el);
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen not supported
    }
  }, []);

  const goPrev = useCallback(() => {
    if (hasPrev) {
      setDirection(-1);
      onNavigate(items[currentIndex - 1]);
    }
  }, [hasPrev, currentIndex, items, onNavigate]);

  const goNext = useCallback(() => {
    if (hasNext) {
      setDirection(1);
      onNavigate(items[currentIndex + 1]);
    }
  }, [hasNext, currentIndex, items, onNavigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!document.fullscreenElement) onClose();
      }
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, goPrev, goNext]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-white hover:bg-white/20 z-10"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </Button>

      {/* Fullscreen toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-14 text-white hover:bg-white/20 z-10"
        onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
        title={isFullscreen ? "Quitter le plein écran (Échap)" : "Plein écran"}
      >
        {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
      </Button>

      {/* Previous */}
      {hasPrev && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-10 h-12 w-12"
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>
      )}

      {/* Next */}
      {hasNext && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-10 h-12 w-12"
          onClick={(e) => { e.stopPropagation(); goNext(); }}
        >
          <ChevronRight className="h-8 w-8" />
        </Button>
      )}

      {/* Media — occupe tout l'espace disponible. Le clic sur le fond ferme ;
          le clic sur le média lui-même ne ferme pas. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-2">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={item.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="flex items-center justify-center w-full h-full"
          >
            {item.file_type === "image" ? (
              <img
                src={item.file_url}
                alt={item.file_name}
                className="pointer-events-auto w-full h-full object-contain rounded"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <video
                src={item.file_url}
                controls
                autoPlay
                playsInline
                className="pointer-events-auto max-w-full max-h-full rounded"
                onClick={(e) => e.stopPropagation()}
              >
                <source src={item.file_url} type={item.mime_type || "video/mp4"} />
              </video>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MediaLightbox;
