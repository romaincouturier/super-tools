import { useMemo, useState } from 'react';
import { ChevronLeft, Plus, Share2, BarChart2, Library, Pencil } from 'lucide-react';

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useBookProductions,
  useDeleteProduction,
  useUpdateProduction,
  useSetAlbumCover,
  useAlbumRawCover,
  extractStoragePath,
} from '@/hooks/useBook';
import BookProductionCard from './BookProductionCard';
import BookProductionLightbox from './BookProductionLightbox';
import BookUploadDialog from './BookUploadDialog';
import BookShareLinksManager from './BookShareLinksManager';
import BookAnalyticsDashboard from './BookAnalyticsDashboard';
import BookMediaLibraryPicker from './BookMediaLibraryPicker';
import BookCreateAlbumDialog from './BookCreateAlbumDialog';
import { useBookAlbums } from '@/hooks/useBook';
import type { BookProduction } from '@/types/book';
import { toast } from '@/hooks/use-toast';
import { useUserPreference } from '@/hooks/useUserPreferences';
import { sortProductions, BOOK_SORT_OPTIONS, type BookSortMode } from '@/lib/bookSort';

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
  const { data: rawCoverUrl } = useAlbumRawCover(albumId);
  const deleteProduction = useDeleteProduction();
  const updateProduction = useUpdateProduction();
  const setAlbumCover = useSetAlbumCover();

  const { value: sortMode, save: saveSortMode } = useUserPreference<BookSortMode>(
    'book.sortMode',
    'recent',
  );
  const productions = useMemo(
    () => sortProductions(rawProductions, sortMode),
    [rawProductions, sortMode],
  );

  const [uploadOpen, setUploadOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const { data: allAlbums = [] } = useBookAlbums();
  const currentAlbum = allAlbums.find((a) => a.id === albumId);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const coverPath = useMemo(() => {
    if (!rawCoverUrl) return null;
    return extractStoragePath(rawCoverUrl) ?? rawCoverUrl;
  }, [rawCoverUrl]);

  function isCover(p: BookProduction): boolean {
    if (!rawCoverUrl || !coverPath) return false;
    if (p.source_media_id) return p.file_url === coverPath;
    const path = extractStoragePath(p.file_url);
    return !!path && path === coverPath;
  }

  function openLightbox(index: number) {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }

  function handleDelete(production: BookProduction) {
    deleteProduction.mutate({
      id: production.id,
      albumId: production.album_id,
      fileUrl: production.file_url,
      sourceMediaId: production.source_media_id,
    });
  }

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

  async function handleSetCover(production: BookProduction) {
    await setAlbumCover.mutateAsync({ albumId, production });
    toast({ title: 'Couverture mise à jour' });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
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

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="w-4 h-4 mr-1.5" />
            Renommer
          </Button>
          <Button variant="outline" size="sm" onClick={() => setStatsOpen(true)}>
            <BarChart2 className="w-4 h-4 mr-1.5" />
            Stats
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
            <Share2 className="w-4 h-4 mr-1.5" />
            Partager
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLibraryOpen(true)}>
            <Library className="w-4 h-4 mr-1.5" />
            Médiathèque
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
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
          <p className="text-lg">Aucune production — ajoutez votre première</p>
          <div className="flex gap-2">
            <Button onClick={() => setUploadOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Ajouter des productions
            </Button>
            <Button variant="outline" onClick={() => setLibraryOpen(true)}>
              <Library className="w-4 h-4 mr-1.5" />
              Depuis la médiathèque
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {productions.map((production, index) => (
            <BookProductionCard
              key={production.id}
              production={production}
              isCover={isCover(production)}
              onClick={() => openLightbox(index)}
              onDelete={() => handleDelete(production)}
              onEdit={() => handleEdit(production)}
              onSetCover={() => handleSetCover(production)}
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
      <BookMediaLibraryPicker
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
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
      <BookCreateAlbumDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        album={currentAlbum}
      />
    </div>
  );
}
