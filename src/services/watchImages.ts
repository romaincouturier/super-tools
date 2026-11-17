import { supabase } from "@/integrations/supabase/client";
import { resolveContentType } from "@/lib/file-utils";
import { uploadWithProgress, type UploadProgressCallback } from "./uploadProgress";
import type { MediaItem } from "@/hooks/useMedia";

export interface PendingWatchImage { id: string; file: File }

export function watchImageError(file: File): string | null {
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(resolveContentType(file))) return "Images acceptées : JPG, JPEG, PNG, WebP et GIF";
  if (!file.size || file.size > 50 * 1024 * 1024) return "L’image doit faire au maximum 50 Mo";
  return null;
}

export async function uploadWatchImage(itemId: string, image: PendingWatchImage, onProgress: UploadProgressCallback): Promise<MediaItem> {
  const invalid = watchImageError(image.file);
  if (invalid) throw new Error(invalid);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Veuillez vous reconnecter avant l’envoi");
  const form = new FormData();
  form.append("file", image.file, image.file.name);
  form.append("watchItemId", itemId);
  form.append("mediaId", image.id);
  const data = await uploadWithProgress(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-watch-file`, "POST", form, {
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${session.access_token}`,
  }, onProgress) as { media?: MediaItem };
  if (!data.media) throw new Error("Image introuvable après enregistrement");
  return data.media;
}