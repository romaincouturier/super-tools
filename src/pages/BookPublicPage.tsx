import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import BookProductionCard from '@/components/book/BookProductionCard';
import BookProductionLightbox from '@/components/book/BookProductionLightbox';
import BookProfileWidget from '@/components/book/BookProfileWidget';
import { usePublicAlbum } from '@/hooks/useBook';
import type { BookProduction } from '@/types/book';
import { sortProductions } from '@/lib/bookSort';

export default function BookPublicPage() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading } = usePublicAlbum(token ?? '');

  // album_view is recorded server-side in book-public-album edge function

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  function openLightbox(index: number) {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }

  const rawProductions = data?.productions ?? [];
  const productions = useMemo(
    () => sortProductions(rawProductions as BookProduction[], 'custom'),
    [rawProductions],
  );


  if (!token) {
    return <NotFound />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return <NotFound />;
  }

  const { album, profile } = data;
  const watermarkText = profile?.bio ?? 'Facilitation graphique';


  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <div className="px-6 py-8 max-w-7xl mx-auto flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">{album.title}</h1>
          {album.description && (
            <p className="text-white/60 mt-2 text-lg">{album.description}</p>
          )}
        </div>
        <Select value={sortMode} onValueChange={(v) => setSortMode(v as BookSortMode)}>
          <SelectTrigger className="h-9 w-[190px] bg-white/10 border-white/20 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BOOK_SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Productions grid */}
      <div className="px-6 pb-16 max-w-7xl mx-auto">
        {productions.length === 0 ? (
          <p className="text-white/40 text-center py-24">Aucune production dans cet album.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {productions.map((production: BookProduction, index: number) => (
              <BookProductionCard
                key={production.id}
                production={production}
                onClick={() => openLightbox(index)}
                onDelete={() => {}}
                onEdit={() => {}}
              />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      <BookProductionLightbox
        productions={productions}
        initialIndex={lightboxIndex}
        currentIndex={lightboxIndex}
        onIndexChange={setLightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        isPublic={true}
        shareToken={token}
        watermarkText={watermarkText}
      />

      <BookProfileWidget profile={profile ?? null} />
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 text-white/60">
      <AlertCircle className="w-12 h-12" />
      <p className="text-xl">Lien introuvable ou révoqué</p>
    </div>
  );
}
