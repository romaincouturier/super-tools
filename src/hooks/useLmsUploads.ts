import { supabase } from "@/integrations/supabase/client";
import { registerMediaEntry } from "@/hooks/useMedia";
import { resolveContentType } from "@/lib/file-utils";

async function uploadAndGetUrl(path: string, file: File, contentType: string): Promise<string> {
  const { error } = await supabase.storage
    .from("lms-content")
    .upload(path, file, { contentType, upsert: true });
  if (error) throw error;
  return supabase.storage.from("lms-content").getPublicUrl(path).data.publicUrl;
}

export async function uploadLmsVideo(file: File, lessonId: string): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
  const contentType = resolveContentType(file) || "video/mp4";
  const publicUrl = await uploadAndGetUrl(`videos/${lessonId}/${Date.now()}.${ext}`, file, contentType);
  await registerMediaEntry({ file_url: publicUrl, file_name: file.name, file_type: "video", mime_type: contentType, file_size: file.size, source_type: "lms", source_id: lessonId });
  return publicUrl;
}

export async function uploadLmsImage(file: File, lessonId: string): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const contentType = resolveContentType(file) || "image/jpeg";
  const publicUrl = await uploadAndGetUrl(`images/${lessonId}/${Date.now()}.${ext}`, file, contentType);
  await registerMediaEntry({ file_url: publicUrl, file_name: file.name, file_type: "image", mime_type: contentType, file_size: file.size, source_type: "lms", source_id: lessonId });
  return publicUrl;
}

export async function uploadLmsFile(file: File, lessonId: string): Promise<{ url: string; name: string; size: number }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
  const contentType = resolveContentType(file) || "application/octet-stream";
  const publicUrl = await uploadAndGetUrl(`files/${lessonId}/${Date.now()}_${safeName}`, file, contentType);
  const mediaType = contentType.startsWith("image/") ? "image" as const
    : contentType.startsWith("video/") ? "video" as const
    : contentType.startsWith("audio/") ? "audio" as const
    : "image" as const; // fallback — media table requires known type
  await registerMediaEntry({ file_url: publicUrl, file_name: file.name, file_type: mediaType, mime_type: contentType, file_size: file.size, source_type: "lms", source_id: lessonId });
  return { url: publicUrl, name: file.name, size: file.size };
}

export async function uploadAssignmentFile(file: File, lessonId: string, email: string): Promise<{ url: string; name: string; size: number }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
  const contentType = resolveContentType(file);
  const publicUrl = await uploadAndGetUrl(`assignments/${lessonId}/${email}/${Date.now()}_${safeName}`, file, contentType);
  return { url: publicUrl, name: file.name, size: file.size };
}
