import { useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Ruler, Calendar, Tag, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useRecordView } from '@/hooks/useBook';
import type { BookProduction } from '@/types/book';

interface BookProductionLightboxProps {
  productions: BookProduction[];
  initialIndex: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isPublic?: boolean;
  shareToken?: string;
  watermarkText?: string;
  currentIndex: number;
  onIndexChange: (index: number) => void;
}

export default function BookProductionLightbox({
  productions,
  open,
  onOpenChange,
  isPublic = false,
  shareToken,
  watermarkText = 'Facilitation graphique',
  currentIndex,
  onIndexChange,
}: BookProductionLightboxProps) {
  const recordView = useRecordView();
  const viewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordedIds = useRef<Set<string>>(new Set());

  const production = productions[currentIndex];

  const goNext = useCallback(() => {
    if (currentIndex < productions.length - 1) {
      onIndexChange(currentIndex + 1);
    }
  }, [currentIndex, productions.length, onIndexChange]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      onIndexChange(currentIndex - 1);
    }
  }, [currentIndex, onIndexChange]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') handleClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, goNext, goPrev, handleClose]);

  // Record production view after 2s
  useEffect(() => {
    if (!open || !isPublic || !shareToken || !production) return;
    if (recordedIds.current.has(production.id)) return;

    viewTimerRef.current = setTimeout(() => {
      recordView.mutate({ token: shareToken, productionId: production.id });
      recordedIds.current.add(production.id);
    }, 2000);

    return () => {
      if (viewTimerRef.current) clearTimeout(viewTimerRef.current);
    };
  }, [open, isPublic, shareToken, production, recordView]);

  if (!open || !production) return null;

  async function handleDownload() {
    if (!production) return;
    await downloadWithWatermark(
      production.file_url,
      production.original_filename ?? `${production.title}.jpg`,
      watermarkText,
    );
  }

  const hasDimensions = production.exif_width != null && production.exif_height != null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" onClick={handleClose}>
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-white font-medium truncate">{production.title}</span>
          {production.tags.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <Tag className="w-3.5 h-3.5 text-white/50 shrink-0" />
              {production.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs h-5">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isPublic && production.file_type === 'image' && (
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              onClick={handleDownload}
            >
              <Download className="w-5 h-5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            onClick={handleClose}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div
        className="flex-1 flex items-center justify-center relative min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Prev arrow */}
        {currentIndex > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 text-white hover:bg-white/10 z-10 h-12 w-12"
            onClick={goPrev}
          >
            <ChevronLeft className="w-8 h-8" />
          </Button>
        )}

        {production.file_type === 'video' ? (
          <video
            key={production.id}
            src={production.file_url}
            controls
            className="max-w-full max-h-full object-contain"
            style={{ maxHeight: 'calc(100vh - 160px)' }}
          />
        ) : (
          <img
            key={production.id}
            src={production.file_url}
            alt={production.title}
            className="max-w-full max-h-full object-contain"
            style={{ maxHeight: 'calc(100vh - 160px)' }}
          />
        )}

        {/* Next arrow */}
        {currentIndex < productions.length - 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 text-white hover:bg-white/10 z-10 h-12 w-12"
            onClick={goNext}
          >
            <ChevronRight className="w-8 h-8" />
          </Button>
        )}
      </div>

      {/* Bottom bar */}
      <div
        className="px-4 py-3 bg-black/60 flex items-center gap-6"
        onClick={(e) => e.stopPropagation()}
      >
        {production.notes && (
          <div className="flex items-start gap-1.5 text-white/80 text-sm min-w-0">
            <StickyNote className="w-4 h-4 shrink-0 mt-0.5 text-white/50" />
            <span className="truncate">{production.notes}</span>
          </div>
        )}
        {production.exif_date && (
          <div className="flex items-center gap-1.5 text-white/60 text-xs shrink-0">
            <Calendar className="w-3.5 h-3.5" />
            <span>{format(new Date(production.exif_date), 'd MMM yyyy', { locale: fr })}</span>
          </div>
        )}
        {hasDimensions && (
          <div className="flex items-center gap-1.5 text-white/60 text-xs shrink-0">
            <Ruler className="w-3.5 h-3.5" />
            <span>{production.exif_width} x {production.exif_height}</span>
          </div>
        )}
        <span className="text-white/40 text-xs ml-auto shrink-0">
          {currentIndex + 1} / {productions.length}
        </span>
      </div>
    </div>
  );
}
