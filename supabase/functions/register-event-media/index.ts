import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createErrorResponse,
  createJsonResponse,
  handleCorsPreflightIfNeeded,
} from "../_shared/cors.ts";
import { getSupabaseClient, verifyAuth } from "../_shared/supabase-client.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getFileType(mime: string): "image" | "video" | "audio" | null {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return null;
}

serve(async (req: Request): Promise<Response> => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization");
    const user = await verifyAuth(authHeader);
    if (!user?.id) return createErrorResponse("Authentification requise", 401);

    const body = await req.json().catch(() => ({}));
    const eventId = String(body?.eventId ?? "").trim();
    const path = String(body?.path ?? "").trim();
    const publicUrl = String(body?.publicUrl ?? "").trim();
    const fileName = String(body?.fileName ?? "").trim() || "media";
    const mimeType = String(body?.mimeType ?? "").trim() || "application/octet-stream";
    const fileSize = Number(body?.fileSize) || 0;

    if (!UUID_RE.test(eventId)) return createErrorResponse("eventId invalide", 400);
    if (!path || !publicUrl) return createErrorResponse("Paramètres manquants", 400);

    const fileType = getFileType(mimeType);
    if (!fileType) return createErrorResponse("Type de fichier non supporté", 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const { data: event, error: eventError } = await userClient
      .from("events")
      .select("id, org_id")
      .eq("id", eventId)
      .maybeSingle();
    if (eventError || !event?.id) {
      return createErrorResponse("Événement introuvable ou inaccessible", 404);
    }

    const admin = getSupabaseClient();
    const { data: media, error: insertError } = await admin
      .from("media")
      .insert({
        file_url: publicUrl,
        file_name: fileName,
        file_type: fileType,
        mime_type: mimeType,
        file_size: fileSize,
        position: 0,
        source_type: "event",
        source_id: eventId,
        created_by: user.id,
        org_id: event.org_id ?? null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[register-event-media] insert error", insertError);
      return createErrorResponse(insertError.message || "Erreur d'enregistrement", 500);
    }

    return createJsonResponse({ media });
  } catch (err) {
    console.error("[register-event-media] unexpected", err);
    return createErrorResponse("Internal error", 500);
  }
});
