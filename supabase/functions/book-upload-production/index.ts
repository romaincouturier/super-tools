import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  createErrorResponse,
  createJsonResponse,
  handleCorsPreflightIfNeeded,
} from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/supabase-client.ts";

function sanitizeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 200) || "file";
}

serve(async (req: Request): Promise<Response> => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    const user = await verifyAuth(req.headers.get("Authorization"));
    if (!user) return createErrorResponse("Unauthorized", 401);

    const formData = await req.formData().catch(() => null);
    if (!formData) return createErrorResponse("Invalid form data", 400);

    const file = formData.get("file") as File | null;
    const albumId = formData.get("albumId") as string | null;

    if (!file) return createErrorResponse("file is required", 400);
    if (!albumId) return createErrorResponse("albumId is required", 400);

    const title =
      (formData.get("title") as string | null) ||
      file.name.replace(/\.[^.]+$/, "") ||
      "Sans titre";
    const notes = (formData.get("notes") as string | null) ?? null;
    const tagsRaw = formData.get("tags") as string | null;
    let tags: string[] = [];
    if (tagsRaw) {
      try { tags = JSON.parse(tagsRaw); } catch { tags = []; }
    }
    const exifDate = (formData.get("exifDate") as string | null) ?? null;
    const exifWidthRaw = formData.get("exifWidth") as string | null;
    const exifHeightRaw = formData.get("exifHeight") as string | null;
    const exifWidth = exifWidthRaw ? parseInt(exifWidthRaw, 10) : null;
    const exifHeight = exifHeightRaw ? parseInt(exifHeightRaw, 10) : null;
    const originalFilename =
      (formData.get("originalFilename") as string | null) ?? file.name ?? null;

    const fileType = file.type.startsWith("video/") ? "video" : "image";

    const sanitizedName = sanitizeFilename(originalFilename ?? file.name ?? "file");
    const timestamp = Date.now();
    const path = `${user.id}/${albumId}/${timestamp}_${sanitizedName}`;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabaseAdmin.storage
      .from("book-productions")
      .upload(path, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[book-upload-production] upload error:", uploadError);
      return createErrorResponse(uploadError.message, 500);
    }

    const { data: publicData } = supabaseAdmin.storage
      .from("book-productions")
      .getPublicUrl(path);

    const fileUrl = publicData.publicUrl;

    const { data: production, error: insertError } = await supabaseAdmin
      .from("book_productions")
      .insert({
        album_id: albumId,
        user_id: user.id,
        title,
        file_url: fileUrl,
        thumbnail_url: null,
        file_type: fileType,
        exif_date: exifDate,
        exif_width: exifWidth,
        exif_height: exifHeight,
        original_filename: originalFilename,
        tags,
        notes,
        sort_order: 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[book-upload-production] insert error:", insertError);
      return createErrorResponse(insertError.message, 500);
    }

    return createJsonResponse({ production });
  } catch (err) {
    console.error("[book-upload-production] Unexpected error:", err);
    return createErrorResponse("Internal error", 500);
  }
});
