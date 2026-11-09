import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { MediaThumb } from "@/components/media/MediaGrid";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { useMediaLibrary, type MediaItem } from "@/hooks/useMedia";
import { maskFileName, maskText } from "@/lib/demoMask";

interface SocialMediaPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (mediaId: string) => void;
}

/** Nom affiché d'un média, masqué en mode démo (règle [065]). */
export function mediaDisplayName(item: Pick<MediaItem, "file_name">, isDemoMode: boolean): string {
  return isDemoMode ? maskFileName(item.file_name) : item.file_name;
}

/** Vignette dont le texte alternatif suit aussi le masque démo. */
export function SocialMediaThumb({ item }: { item: MediaItem }) {
  const { isDemoMode } = useDemoMode();
  return <MediaThumb item={{ ...item, file_name: mediaDisplayName(item, isDemoMode) }} />;
}

/** Choix d'une image de la Médiathèque existante, sans aucun envoi de fichier. */
export default function SocialMediaPicker({ open, onOpenChange, onSelect }: SocialMediaPickerProps) {
  const { data: media = [], isLoading, isError } = useMediaLibrary({ enabled: open });
  const { isDemoMode } = useDemoMode();
  const [search, setSearch] = useState("");

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    // En mode démo, la recherche ne porte que sur les valeurs masquées (règle [065]).
    const haystack = (m: MediaItem) => (isDemoMode
      ? [mediaDisplayName(m, true), maskText(m.source_label)]
      : [m.file_name, m.source_label, ...(m.tags || [])]);
    return media
      .filter((m) => m.file_type === "image")
      .filter((m) => !q || haystack(m).some((v) => v.toLowerCase().includes(q)));
  }, [media, search, isDemoMode]);

  const close = (next: boolean) => {
    if (!next) setSearch("");
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="w-full sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Choisir un visuel dans la Médiathèque</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            aria-label="Rechercher un visuel"
            placeholder="Rechercher par nom, source ou tag"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {isLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : isError ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Impossible de charger la Médiathèque.</p>
          ) : items.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Aucune image dans la Médiathèque.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {items.map((m) => {
                const name = mediaDisplayName(m, isDemoMode);
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-label={`Choisir ${name}`}
                    onClick={() => { onSelect(m.id); close(false); }}
                    className="relative rounded-md overflow-hidden aspect-square bg-muted border-2 border-transparent hover:border-primary focus-visible:border-primary"
                  >
                    <SocialMediaThumb item={m} />
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 text-left">
                      <p className="text-[10px] text-white truncate">{name}</p>
                      <p className="text-[10px] text-white/70 truncate">{isDemoMode ? maskText(m.source_label) : m.source_label}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
