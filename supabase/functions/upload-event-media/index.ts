import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/supabase-client.ts";

const BUCKET = "media";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_FILE_SIZE = 250 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image", "video", "audio"]);

function sanitizeFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .toLowerCase();
}

function resolveContentType(file: File): string {
  const rawType = file.type?.toLowerCase().split(";")[0].trim();
  const normalized: Record<string, string> = {
    "audio/x-m4a": "audio/mp4",
    "audio/x-wav": "audio/wav",
    "audio/x-aac": "audio/aac",
  };
  if (rawType) return normalized[rawType] || rawType;

  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    m4a: "audio/mp4",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    aac: "audio/aac",
    ogg: "audio/ogg",
    caf: "audio/x-caf",
    flac: "audio/flac",
    wma: "audio/x-ms-wma",
  };
  return map[ext] || "application/octet-stream";
}

function getFileType(contentType: string): "image" | "video" | "audio" | null {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  if (contentType.startsWith("audio/")) return "audio";
  return null;
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return createErrorResponse("Method not allowed", 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const user = await verifyAuth(authHeader);
    if (!user?.id) {
      return createErrorResponse("Authentification requise", 401);
    }

    const form = await req.formData();
    const eventId = String(form.get("eventId") || "");
    const file = form.get("file");

    if (!UUID_RE.test(eventId)) {
      return createErrorResponse("Événement invalide", 400);
    }
    if (!(file instanceof File)) {
      return createErrorResponse("Fichier manquant", 400);
    }
    if (file.size <= 0) {
      return createErrorResponse("Fichier vide", 400);
    }
    if (file.size > MAX_FILE_SIZE) {
      return createErrorResponse("Fichier trop volumineux", 413);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return createErrorResponse("Configuration serveur manquante", 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const { data: event, error: eventError } = await userClient
      .from("events")
      .select("id, org_id")
      .eq("id", eventId)
      .maybeSingle();

    if (eventError) {
      console.error("[upload-event-media] event access check error", eventError);
      return createErrorResponse("Impossible de vérifier l'accès à l'événement", 403);
    }
    if (!event?.id) {
      return createErrorResponse("Événement introuvable ou inaccessible", 404);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const contentType = resolveContentType(file);
    const fileType = getFileType(contentType);
    if (!fileType || !ALLOWED_TYPES.has(fileType)) {
      return createErrorResponse("Type de fichier non supporté", 400);
    }

    const sanitizedName = sanitizeFileName(file.name || "media");
    const path = `event/${eventId}/${Date.now()}_${sanitizedName}`;

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, file, { contentType, upsert: false });

    if (uploadError) {
      console.error("[upload-event-media] storage error", uploadError);
      return createErrorResponse(uploadError.message || "Erreur de stockage", 500);
    }

    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    const { data: media, error: insertError } = await admin
      .from("media")
      .insert({
        file_url: publicUrl,
        file_name: file.name || sanitizedName,
        file_type: fileType,
        mime_type: contentType,
        file_size: file.size,
        position: 0,
        source_type: "event",
        source_id: eventId,
        created_by: user.id,
        org_id: event.org_id ?? null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[upload-event-media] media insert error", insertError);
      await admin.storage.from(BUCKET).remove([path]);
      return createErrorResponse(insertError.message || "Erreur d'enregistrement du média", 500);
    }

    return createJsonResponse({ url: publicUrl, media });
  } catch (error) {
    console.error("[upload-event-media] unexpected error", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
