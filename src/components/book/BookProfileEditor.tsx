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
import { useBookProfile, useUpsertBookProfile } from '@/hooks/useBook';

const BIO_MAX = 200;

interface BookProfileEditorProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function BookProfileEditor({ open, onOpenChange }: BookProfileEditorProps) {
  const { data: profile } = useBookProfile();
  const upsert = useUpsertBookProfile();

  const [photoUrl, setPhotoUrl] = useState('');
  const [bio, setBio] = useState('');

  useEffect(() => {
    if (open && profile) {
      setPhotoUrl(profile.photo_url ?? '');
      setBio(profile.bio ?? '');
    } else if (!open) {
      setPhotoUrl('');
      setBio('');
    }
  }, [open, profile]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await upsert.mutateAsync({
      photo_url: photoUrl.trim() || null,
      bio: bio.trim() || null,
    });
    onOpenChange(false);
  }

  const isValidPhotoUrl = photoUrl.trim().startsWith('http');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mon profil</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Photo URL */}
          <div className="space-y-2">
            <Label htmlFor="photo-url">URL de la photo</Label>
            <Input
              id="photo-url"
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://..."
              disabled={upsert.isPending}
            />
            {isValidPhotoUrl && (
              <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/40">
                <img
                  src={photoUrl}
                  alt="Aperçu"
                  className="w-12 h-12 rounded-full object-cover border"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <span className="text-xs text-muted-foreground">Aperçu</span>
              </div>
            )}
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="bio">Bio</Label>
              <span className={`text-xs ${bio.length > BIO_MAX ? 'text-destructive' : 'text-muted-foreground'}`}>
                {bio.length} / {BIO_MAX}
              </span>
            </div>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
              placeholder="Facilitation graphique, storytelling visuel..."
              rows={4}
              disabled={upsert.isPending}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={upsert.isPending}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={upsert.isPending}>
              {upsert.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
