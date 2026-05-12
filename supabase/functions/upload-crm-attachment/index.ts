import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/supabase-client.ts";

const BUCKET = "crm-attachments";

function sanitizeFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .toLowerCase();
}

function resolveContentType(file: File): string {
  if (file.type) return file.type.toLowerCase().split(";")[0].trim();
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
    csv: "text/csv",
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
    const sanitizedName = sanitizeFileName(file.name || "fichier");
    const filePath = `${cardId}/${Date.now()}_${sanitizedName}`;

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(filePath, file, { contentType, upsert: false });

    if (uploadError) {
      console.error("[upload-crm-attachment] storage error", uploadError);
      return createErrorResponse(uploadError.message || "Erreur de stockage", 500);
    }

    const { data: attachment, error: insertError } = await admin
      .from("crm_attachments")
      .insert({
        card_id: cardId,
        file_name: file.name || sanitizedName,
        file_path: filePath,
        file_size: file.size,
        mime_type: contentType,
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("[upload-crm-attachment] db error", insertError);
      await admin.storage.from(BUCKET).remove([filePath]);
      return createErrorResponse(insertError.message || "Erreur d'enregistrement", 500);
    }

    return createJsonResponse({ attachment });
  } catch (error) {
    console.error("[upload-crm-attachment] unexpected error", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
