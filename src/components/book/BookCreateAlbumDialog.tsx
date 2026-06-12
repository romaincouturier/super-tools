import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateAlbum, useUpdateAlbum } from '@/hooks/useBook';
import type { BookAlbum } from '@/types/book';

interface BookCreateAlbumDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  album?: BookAlbum;
}

export default function BookCreateAlbumDialog({
  open,
  onOpenChange,
  album,
}: BookCreateAlbumDialogProps) {
  const isEdit = Boolean(album);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const createAlbum = useCreateAlbum();
  const updateAlbum = useUpdateAlbum();

  const isPending = createAlbum.isPending || updateAlbum.isPending;

  useEffect(() => {
    if (open && album) {
      setTitle(album.title);
      setDescription(album.description ?? '');
    } else if (!open) {
      setTitle('');
      setDescription('');
    }
  }, [open, album]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    if (isEdit && album) {
      await updateAlbum.mutateAsync({ id: album.id, title: title.trim(), description: description.trim() || undefined });
    } else {
      await createAlbum.mutateAsync({ title: title.trim(), description: description.trim() || undefined });
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier l\'album' : 'Nouvel album'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="album-title">Titre *</Label>
            <Input
              id="album-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nom de l'album"
              required
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="album-description">Description</Label>
            <Textarea
              id="album-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description optionnelle"
              rows={3}
              disabled={isPending}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending || !title.trim()}>
              {isPending ? 'Enregistrement...' : isEdit ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
