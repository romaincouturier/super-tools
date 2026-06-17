import { useMemo, useState } from 'react';
import { Check, ImageIcon, Video, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useMediaLibrary } from '@/hooks/useMedia';
import { useAddMediaToAlbum } from '@/hooks/useBook';
import { toast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  albumId: string;
}

export default function BookMediaLibraryPicker({ open, onOpenChange, albumId }: Props) {
  const { data: media = [], isLoading } = useMediaLibrary();
  const addToAlbum = useAddMediaToAlbum();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return media
      .filter((m) => m.file_type === 'image' || m.file_type === 'video')
      .filter((m) =>
        !q ||
        m.file_name.toLowerCase().includes(q) ||
        m.source_label.toLowerCase().includes(q) ||
        (m.tags || []).some((t) => t.toLowerCase().includes(q))
      );
  }, [media, search]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function close() {
    setSelected(new Set());
    setSearch('');
    onOpenChange(false);
  }

  async function handleAdd() {
    const chosen = items.filter((m) => selected.has(m.id));
    if (chosen.length === 0) return;
    await addToAlbum.mutateAsync({
      albumId,
      items: chosen.map((m) => ({
        id: m.id,
        file_url: m.file_url,
        file_name: m.file_name,
        file_type: m.file_type,
      })),
    });
    toast({ title: `${chosen.length} élément(s) ajouté(s) à l'album` });
    close();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : close())}>
      <DialogContent className="w-full sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Ajouter depuis la médiathèque</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, source ou tag"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Chargement…</div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              Aucun média compatible (images ou vidéos)
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {items.map((m) => {
                const isSelected = selected.has(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggle(m.id)}
                    className={`group relative rounded-md overflow-hidden aspect-square bg-gray-100 border-2 transition-all ${
                      isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-transparent'
                    }`}
                  >
                    {m.file_type === 'video' ? (
                      <div className="w-full h-full flex items-center justify-center bg-gray-800">
                        <Video className="w-8 h-8 text-gray-300" />
                      </div>
                    ) : (
                      <img
                        src={m.file_url}
                        alt={m.file_name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    )}
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <Check className="w-4 h-4" />
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 text-left">
                      <p className="text-[10px] text-white truncate">{m.file_name}</p>
                      <p className="text-[10px] text-white/70 truncate flex items-center gap-1">
                        {m.source_emoji && <span>{m.source_emoji}</span>}
                        {m.source_label}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <Badge variant="secondary">
            {selected.size} sélectionné{selected.size > 1 ? 's' : ''}
          </Badge>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={close} disabled={addToAlbum.isPending}>
              Annuler
            </Button>
            <Button
              onClick={handleAdd}
              disabled={selected.size === 0 || addToAlbum.isPending}
            >
              <ImageIcon className="w-4 h-4 mr-1.5" />
              {addToAlbum.isPending ? 'Ajout…' : `Ajouter (${selected.size})`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
