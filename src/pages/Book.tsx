import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ModuleLayout from '@/components/ModuleLayout';
import PageHeader from '@/components/PageHeader';
import BookAlbumGrid from '@/components/book/BookAlbumGrid';
import BookCreateAlbumDialog from '@/components/book/BookCreateAlbumDialog';
import BookShareLinksManager from '@/components/book/BookShareLinksManager';
import BookProfileEditor from '@/components/book/BookProfileEditor';
import BookProfileWidget from '@/components/book/BookProfileWidget';
import { useBookAlbums, useBookProfile, useDeleteAlbum } from '@/hooks/useBook';
import type { BookAlbum } from '@/types/book';

export default function Book() {
  const navigate = useNavigate();
  const { data: albums = [], isLoading } = useBookAlbums();
  const { data: profile } = useBookProfile();
  const deleteAlbum = useDeleteAlbum();

  const [createOpen, setCreateOpen] = useState(false);
  const [editAlbum, setEditAlbum] = useState<BookAlbum | undefined>(undefined);
  const [shareAlbumId, setShareAlbumId] = useState<string | null>(null);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);

  function handleAlbumClick(id: string) {
    navigate(`/book/album/${id}`);
  }

  function handleShare(album: BookAlbum) {
    setShareAlbumId(album.id);
  }

  function handleEdit(album: BookAlbum) {
    setEditAlbum(album);
    setCreateOpen(true);
  }

  function handleDelete(album: BookAlbum) {
    if (!window.confirm(`Supprimer l'album "${album.title}" et toutes ses productions ?`)) return;
    deleteAlbum.mutate(album.id);
  }

  function handleCreateDialogChange(open: boolean) {
    setCreateOpen(open);
    if (!open) setEditAlbum(undefined);
  }

  return (
    <ModuleLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <PageHeader
          title="Book de productions"
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setProfileEditorOpen(true)}>
                <User className="w-4 h-4 mr-1.5" />
                Modifier mon profil
              </Button>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" />
                Nouvel album
              </Button>
            </div>
          }
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            Chargement...
          </div>
        ) : (
          <BookAlbumGrid
            albums={albums}
            onAlbumClick={handleAlbumClick}
            onShare={handleShare}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      </div>

      <BookCreateAlbumDialog
        open={createOpen}
        onOpenChange={handleCreateDialogChange}
        album={editAlbum}
      />

      {shareAlbumId && (
        <BookShareLinksManager
          albumId={shareAlbumId}
          open={shareAlbumId != null}
          onOpenChange={(v) => { if (!v) setShareAlbumId(null); }}
        />
      )}

      <BookProfileEditor
        open={profileEditorOpen}
        onOpenChange={setProfileEditorOpen}
      />

      <BookProfileWidget profile={profile ?? null} />
    </ModuleLayout>
  );
}
