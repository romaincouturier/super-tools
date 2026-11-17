import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { uploadWatchImage, watchImageError, type PendingWatchImage } from "@/services/watchImages";
import type { MediaUploadState } from "@/components/media/MediaUploadProgress";

export function useWatchImages() {
  const [images, setImages] = useState<PendingWatchImage[]>([]);
  const [progress, setProgress] = useState<MediaUploadState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const select = (files: File[]) => {
    const rejected = files.find((file) => watchImageError(file));
    if (rejected) { setError(`${rejected.name} : ${watchImageError(rejected)}`); return; }
    setError(null);
    setImages((previous) => [...previous, ...files.map((file) => ({ id: crypto.randomUUID(), file }))]);
  };
  const upload = async (itemId: string) => {
    let done = 0;
    setError(null);
    try {
      for (const image of images) {
        setProgress({ done, total: images.length, fileName: image.file.name, percent: 0, failed: 0 });
        await uploadWatchImage(itemId, image, (percent) => setProgress({ done, total: images.length, fileName: image.file.name, percent, failed: 0 }));
        done++;
        setImages((previous) => previous.filter((entry) => entry.id !== image.id));
        setProgress({ done, total: images.length, fileName: image.file.name, percent: 100, failed: 0 });
        await queryClient.invalidateQueries({ queryKey: ["entity-media", "watch", itemId] });
        await queryClient.invalidateQueries({ queryKey: ["media-library"] });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Échec de l’envoi des images");
      setProgress((previous) => previous ? { ...previous, failed: 1 } : null);
      throw cause;
    }
  };
  return { images, progress, error, select, upload,
    remove: (id: string) => setImages((previous) => previous.filter((image) => image.id !== id)),
    reset: () => { setImages([]); setProgress(null); setError(null); },
  };
}