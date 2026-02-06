import { MediaItemWithMission } from "@/hooks/useMediaLibrary";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Briefcase, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useCallback } from "react";

interface MediaLightboxProps {
  item: MediaItemWithMission;
  items: MediaItemWithMission[];
  onClose: () => void;
  onNavigate: (item: MediaItemWithMission) => void;
}

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

const MediaLightbox = ({ item, items, onClose, onNavigate }: MediaLightboxProps) => {
  const currentIndex = items.findIndex((i) => i.id === item.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < items.length - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) onNavigate(items[currentIndex - 1]);
  }, [hasPrev, currentIndex, items, onNavigate]);

  const goNext = useCallback(() => {
    if (hasNext) onNavigate(items[currentIndex + 1]);
  }, [hasNext, currentIndex, items, onNavigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, goPrev, goNext]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
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

      {/* Media */}
      <div
        className="max-w-[90vw] max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {item.file_type === "image" ? (
          <img
            src={item.file_url}
            alt={item.file_name}
            className="max-w-full max-h-[85vh] object-contain rounded"
          />
        ) : (
          <video
            src={item.file_url}
            controls
            autoPlay
            className="max-w-full max-h-[85vh] rounded"
          />
        )}
      </div>

      {/* Info bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg">
        <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
          <Briefcase className="h-3 w-3 mr-1" />
          {item.mission_emoji ? `${item.mission_emoji} ` : ""}
          {item.mission_title}
        </Badge>
        <span className="text-white text-sm">{item.file_name}</span>
        {item.file_size && (
          <span className="text-white/60 text-sm">{formatFileSize(item.file_size)}</span>
        )}
        <span className="text-white/40 text-xs">
          {currentIndex + 1} / {items.length}
        </span>
      </div>
    </div>
  );
};

export default MediaLightbox;
