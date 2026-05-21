import { supabase } from "@/integrations/supabase/client";
import { registerMediaEntry } from "@/hooks/useMedia";
import { resolveContentType } from "@/lib/file-utils";

/**
 * Upload a file to the lms-content bucket via the upload-lms-content edge
 * function.  The edge function uses the SERVICE_ROLE_KEY server-side, which
 * completely bypasses storage RLS — no more "row violates row-level security
 * policy" errors regardless of the client's auth state.
 */
async function uploadAndGetUrl(path: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("path", path);

  const { data, error } = await supabase.functions.invoke("upload-lms-content", {
    body: formData,
  });

  if (error) throw error;
  const publicUrl = (data as { publicUrl?: string } | null)?.publicUrl;
  if (!publicUrl) throw new Error("URL du fichier introuvable après l'upload");
  return publicUrl;
}

export async function uploadLmsVideo(file: File, lessonId: string): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
  const contentType = resolveContentType(file) || "video/mp4";
  const publicUrl = await uploadAndGetUrl(`videos/${lessonId}/${Date.now()}.${ext}`, file);
  await registerMediaEntry({ file_url: publicUrl, file_name: file.name, file_type: "video", mime_type: contentType, file_size: file.size, source_type: "lms", source_id: lessonId });
  return publicUrl;
}

export async function uploadLmsImage(file: File, lessonId: string): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const contentType = resolveContentType(file) || "image/jpeg";
  const publicUrl = await uploadAndGetUrl(`images/${lessonId}/${Date.now()}.${ext}`, file);
  await registerMediaEntry({ file_url: publicUrl, file_name: file.name, file_type: "image", mime_type: contentType, file_size: file.size, source_type: "lms", source_id: lessonId });
  return publicUrl;
}

export async function uploadLmsFile(file: File, lessonId: string): Promise<{ url: string; name: string; size: number }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
  const contentType = resolveContentType(file) || "application/octet-stream";
  const publicUrl = await uploadAndGetUrl(`files/${lessonId}/${Date.now()}_${safeName}`, file);
  const mediaType = contentType.startsWith("image/") ? "image" as const
    : contentType.startsWith("video/") ? "video" as const
    : contentType.startsWith("audio/") ? "audio" as const
    : "image" as const;
  await registerMediaEntry({ file_url: publicUrl, file_name: file.name, file_type: mediaType, mime_type: contentType, file_size: file.size, source_type: "lms", source_id: lessonId });
  return { url: publicUrl, name: file.name, size: file.size };
}

export async function uploadAssignmentFile(file: File, lessonId: string, email: string): Promise<{ url: string; name: string; size: number }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
  const publicUrl = await uploadAndGetUrl(`assignments/${lessonId}/${email}/${Date.now()}_${safeName}`, file);
  return { url: publicUrl, name: file.name, size: file.size };
}

export async function uploadForumAttachment(file: File, courseId: string, email: string): Promise<{ url: string; name: string }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
  const publicUrl = await uploadAndGetUrl(`forum-attachments/${courseId}/${email}/${Date.now()}_${safeName}`, file);
  return { url: publicUrl, name: file.name };
}
