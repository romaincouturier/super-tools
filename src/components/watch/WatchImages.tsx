import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useEntityMedia, type MediaItem } from "@/hooks/useMedia";
import { useResolvedStorageUrl } from "@/hooks/useResolvedStorageUrl";
import { useWatchImages } from "@/hooks/useWatchImages";
import MediaUploadProgress from "@/components/media/MediaUploadProgress";
import MediaLightbox from "@/components/media/MediaLightbox";

function PendingThumbnail({ file }: { file: File }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const preview = URL.createObjectURL(file);
    setUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [file]);
  return <img src={url} alt={file.name} className="aspect-square w-full object-contain bg-muted rounded-md" />;
}

function SavedThumbnail({ image, onOpen }: { image: MediaItem; onOpen: () => void }) {
  const url = useResolvedStorageUrl(image.file_url);
  return <Button type="button" variant="ghost" onClick={onOpen} className="h-auto min-w-0 w-full p-0 overflow-hidden" aria-label={`Ouvrir ${image.file_name}`}>
    <img src={url ?? undefined} alt={image.file_name} loading="lazy" className="aspect-square w-full object-contain bg-muted rounded-md" />
  </Button>;
}

export function WatchImageGallery({ itemId, omitUrl }: { itemId: string; omitUrl?: string | null }) {
  const { data: media = [] } = useEntityMedia("watch", itemId);
  const images = media.filter((image) => image.file_type === "image" && image.file_url !== omitUrl);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  if (!images.length) return null;
  return <>
    <div className="grid grid-cols-3 gap-2">
      {images.map((image) => <SavedThumbnail key={image.id} image={image} onOpen={() => setSelected(image)} />)}
    </div>
    {selected && <MediaLightbox item={selected} items={images} onNavigate={setSelected} onClose={() => setSelected(null)} />}
  </>;
}

export function WatchImagePicker({ state, disabled }: { state: ReturnType<typeof useWatchImages>; disabled: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return <div className="space-y-2">
    <div className="flex items-center justify-between gap-2">
      <Label>Images{state.images.length > 0 && ` (${state.images.length})`}</Label>
      <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => input.current?.click()}>
        <ImagePlus className="h-4 w-4 mr-2" /> Ajouter des images
      </Button>
    </div>
    <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif" className="hidden" aria-label="Images de veille" disabled={disabled} onChange={(event) => {
      state.select(Array.from(event.target.files || [])); event.target.value = "";
    }} />
    <p className="text-xs text-muted-foreground">JPG, JPEG, PNG, WebP, GIF · 50 Mo par image</p>
    <div className="grid grid-cols-3 gap-2">
      {state.images.map((image) => <div key={image.id} className="relative min-w-0">
        <PendingThumbnail file={image.file} />
        <Button type="button" variant="secondary" size="icon" className="absolute top-1 right-1 h-6 w-6" disabled={disabled} aria-label={`Retirer ${image.file.name}`} onClick={() => state.remove(image.id)}><X className="h-3 w-3" /></Button>
        <p className="text-xs truncate mt-1">{image.file.name}</p>
      </div>)}
    </div>
    {state.progress && <MediaUploadProgress state={state.progress} />}
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
  </div>;
}