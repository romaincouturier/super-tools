import { supabase } from "@/integrations/supabase/client";
import { registerMediaEntry } from "@/hooks/useMedia";
import { resolveContentType } from "@/lib/file-utils";

export async function uploadLmsVideo(file: File, lessonId: string): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
  const path = `videos/${lessonId}/${Date.now()}.${ext}`;
  const contentType = resolveContentType(file) || "video/mp4";
  const { error } = await supabase.storage
    .from("lms-content")
    .upload(path, file, { contentType, upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("lms-content").getPublicUrl(path);
  const publicUrl = data.publicUrl;
  await registerMediaEntry({
    file_url: publicUrl,
    file_name: file.name,
    file_type: "video",
    mime_type: contentType,
    file_size: file.size,
    source_type: "lms",
    source_id: lessonId,
  });
  return publicUrl;
}

export async function uploadLmsImage(file: File, lessonId: string): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `images/${lessonId}/${Date.now()}.${ext}`;
  const contentType = resolveContentType(file) || "image/jpeg";
  const { error } = await supabase.storage
    .from("lms-content")
    .upload(path, file, { contentType, upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("lms-content").getPublicUrl(path);
  const publicUrl = data.publicUrl;
  await registerMediaEntry({
    file_url: publicUrl,
    file_name: file.name,
    file_type: "image",
    mime_type: contentType,
    file_size: file.size,
    source_type: "lms",
    source_id: lessonId,
  });
  return publicUrl;
}

export async function uploadLmsFile(file: File, lessonId: string): Promise<{ url: string; name: string; size: number }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
  const path = `files/${lessonId}/${Date.now()}_${safeName}`;
  const contentType = resolveContentType(file) || "application/octet-stream";
  const { error } = await supabase.storage
    .from("lms-content")
    .upload(path, file, { contentType, upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("lms-content").getPublicUrl(path);
  const publicUrl = data.publicUrl;
  const mediaType = contentType.startsWith("image/") ? "image" as const
    : contentType.startsWith("video/") ? "video" as const
    : contentType.startsWith("audio/") ? "audio" as const
    : "image" as const; // fallback — media table requires known type
  await registerMediaEntry({
    file_url: publicUrl,
    file_name: file.name,
    file_type: mediaType,
    mime_type: contentType,
    file_size: file.size,
    source_type: "lms",
    source_id: lessonId,
  });
  return { url: publicUrl, name: file.name, size: file.size };
}

export async function uploadAssignmentFile(file: File, lessonId: string, email: string): Promise<{ url: string; name: string; size: number }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
  const path = `assignments/${lessonId}/${email}/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage
    .from("lms-content")
    .upload(path, file, { contentType: resolveContentType(file), upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("lms-content").getPublicUrl(path);
  return { url: data.publicUrl, name: file.name, size: file.size };
}
