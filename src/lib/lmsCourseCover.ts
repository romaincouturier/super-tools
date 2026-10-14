import { supabase } from "@/integrations/supabase/client";
import { resolveContentType } from "@/lib/file-utils";

export const COURSE_COVER_ACCEPT = ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";
export const COURSE_COVER_MAX_BYTES = 5 * 1024 * 1024;

export function validateCourseCover(file: File): void {
  if (!/\.(png|jpe?g|webp)$/i.test(file.name) ||
      !["image/png", "image/jpeg", "image/webp"].includes(resolveContentType(file))) {
    throw new Error("Formats acceptés : PNG, JPG et WebP.");
  }
  if (file.size > COURSE_COVER_MAX_BYTES) {
    throw new Error("L’image ne doit pas dépasser 5 Mo.");
  }
}

export async function uploadCourseCover(file: File, courseId: string): Promise<string> {
  validateCourseCover(file);
  const extension = resolveContentType(file).split("/")[1];
  const path = `images/${courseId}/cover-${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("lms-content").upload(path, file, {
    contentType: resolveContentType(file),
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from("lms-content").getPublicUrl(path).data.publicUrl;
}