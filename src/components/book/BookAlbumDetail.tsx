import { useState } from 'react';
import { ChevronLeft, Plus, Share2, BarChart2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useBookProductions, useDeleteProduction, useUpdateProduction } from '@/hooks/useBook';
import BookProductionCard from './BookProductionCard';
import BookProductionLightbox from './BookProductionLightbox';
import BookUploadDialog from './BookUploadDialog';
import BookShareLinksManager from './BookShareLinksManager';
import BookAnalyticsDashboard from './BookAnalyticsDashboard';
import type { BookProduction } from '@/types/book';

interface BookAlbumDetailProps {
  albumId: string;
  albumTitle?: string;
  albumDescription?: string | null;
}

export default function BookAlbumDetail({
  albumId,
  albumTitle,
  albumDescription,
}: BookAlbumDetailProps) {
  const navigate = useNavigate();
  const { data: productions = [], isLoading } = useBookProductions(albumId);
  const deleteProduction = useDeleteProduction();
  const updateProduction = useUpdateProduction();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  function openLightbox(index: number) {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }

  function handleDelete(production: BookProduction) {
    deleteProduction.mutate({
      id: production.id,
      albumId: production.album_id,
      fileUrl: production.file_url,
    });
  }

  // Edit handler — opens a simple inline rename for now via the lightbox title.
  // A full edit dialog would be a separate component; here we trigger a prompt for simplicity.
  function handleEdit(production: BookProduction) {
    const newTitle = window.prompt('Nouveau titre', production.title);
    if (newTitle && newTitle.trim() && newTitle.trim() !== production.title) {
      updateProduction.mutate({
        id: production.id,
        albumId: production.album_id,
        title: newTitle.trim(),
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/book')}
            className="shrink-0 mt-0.5"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{albumTitle ?? 'Album'}</h1>
            {albumDescription && (
              <p className="text-muted-foreground mt-1">{albumDescription}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setStatsOpen(true)}>
            <BarChart2 className="w-4 h-4 mr-1.5" />
            Stats
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
            <Share2 className="w-4 h-4 mr-1.5" />
            Partager
          </Button>
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Ajouter des productions
          </Button>
        </div>
      </div>

      {/* Productions grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          Chargement...
        </div>
      ) : productions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <p className="text-lg">Aucune production — ajoutez votre première</p>
          <Button className="mt-4" onClick={() => setUploadOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Ajouter des productions
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {productions.map((production, index) => (
            <BookProductionCard
              key={production.id}
              production={production}
              onClick={() => openLightbox(index)}
              onDelete={() => handleDelete(production)}
              onEdit={() => handleEdit(production)}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <BookUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        albumId={albumId}
      />
      <BookShareLinksManager
        albumId={albumId}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
      <BookAnalyticsDashboard
        albumId={albumId}
        open={statsOpen}
        onOpenChange={setStatsOpen}
      />
      <BookProductionLightbox
        productions={productions}
        initialIndex={lightboxIndex}
        currentIndex={lightboxIndex}
        onIndexChange={setLightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </div>
  );
}
