import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/supabase-client.ts";

const BUCKET = "mission-media";

function sanitizeFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .toLowerCase();
}

function resolveContentType(file: File): string {
  if (file.type) return file.type.toLowerCase().split(";")[0].trim();
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    heic: "image/heic",
    heif: "image/heif",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
  };
  return map[ext] || "application/octet-stream";
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return createErrorResponse("Method not allowed", 405);
  }

  try {
    const user = await verifyAuth(req.headers.get("Authorization"));
    if (!user?.id) {
      return createErrorResponse("Authentification requise", 401);
    }

    const form = await req.formData();
    const missionId = String(form.get("missionId") || "");
    const pageId = String(form.get("pageId") || "");
    const file = form.get("file");

    if (!missionId || !/^[0-9a-f-]{36}$/i.test(missionId)) {
      return createErrorResponse("Mission invalide", 400);
    }
    if (!pageId || !/^[0-9a-f-]{36}$/i.test(pageId)) {
      return createErrorResponse("Page invalide", 400);
    }
    if (!(file instanceof File)) {
      return createErrorResponse("Fichier manquant", 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return createErrorResponse("Configuration serveur manquante", 500);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const sanitizedName = sanitizeFileName(file.name || "image");
    const contentType = resolveContentType(file);
    const ext = sanitizedName.includes(".") ? sanitizedName.split(".").pop() : "bin";
    const path = `pages/${pageId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, file, { contentType, upsert: false });

    if (uploadError) {
      console.error("[upload-mission-media] storage error", uploadError);
      return createErrorResponse(uploadError.message || "Erreur de stockage", 500);
    }

    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = urlData.publicUrl;
    const fileType = contentType.startsWith("video/") ? "video" : "image";

    const { error: insertError } = await admin.from("media").insert({
      file_url: publicUrl,
      file_name: file.name || sanitizedName,
      file_type: fileType,
      mime_type: contentType,
      file_size: file.size,
      position: 0,
      source_type: "mission",
      source_id: missionId,
      created_by: user.id,
    });

    if (insertError) {
      console.warn("[upload-mission-media] db register warning", insertError);
      // Best-effort: do not fail the upload if media registry insert fails.
    }

    return createJsonResponse({ url: publicUrl });
  } catch (error) {
    console.error("[upload-mission-media] unexpected error", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
