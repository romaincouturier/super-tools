import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/supabase-client.ts";

const BUCKET = "crm-attachments";

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
  };
  return map[ext] || "image/png";
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
    const cardId = String(form.get("cardId") || "");
    const file = form.get("file");

    if (!cardId || !/^[0-9a-f-]{36}$/i.test(cardId)) {
      return createErrorResponse("cardId invalide", 400);
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
    const contentType = resolveContentType(file);
    const ext = contentType.split("/")[1] || "png";
    const fileName = `${cardId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(fileName, file, { contentType, upsert: false });

    if (uploadError) {
      console.error("[upload-crm-image] storage error", uploadError);
      return createErrorResponse(uploadError.message || "Erreur de stockage", 500);
    }

    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(fileName);
    const publicUrl = urlData.publicUrl;

    const { error: insertError } = await admin
      .from("media")
      .insert({
        file_url: publicUrl,
        file_name: file.name,
        file_type: "image",
        mime_type: contentType,
        file_size: file.size,
        source_type: "crm",
        source_id: cardId,
      });

    if (insertError) {
      console.error("[upload-crm-image] db error", insertError);
      await admin.storage.from(BUCKET).remove([fileName]);
      return createErrorResponse(insertError.message || "Erreur d'enregistrement", 500);
    }

    return createJsonResponse({ publicUrl });
  } catch (error) {
    console.error("[upload-crm-image] unexpected error", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
