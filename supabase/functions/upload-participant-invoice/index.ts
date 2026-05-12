import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/supabase-client.ts";

const BUCKET = "training-documents";

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
    const participantId = String(form.get("participantId") || "");
    const trainingId = String(form.get("trainingId") || "");
    const file = form.get("file");

    if (!participantId || !/^[0-9a-f-]{36}$/i.test(participantId)) {
      return createErrorResponse("participantId invalide", 400);
    }
    if (!trainingId || !/^[0-9a-f-]{36}$/i.test(trainingId)) {
      return createErrorResponse("trainingId invalide", 400);
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
    const fileExt = file.name.split(".").pop() || "pdf";
    const baseName = file.name.replace(`.${fileExt}`, "");
    const sanitizedName = sanitizeFileName(baseName);
    const filePath = `${trainingId}/participant_${participantId}/facture_${Date.now()}_${sanitizedName}.${fileExt}`;

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(filePath, file, { contentType, upsert: false });

    if (uploadError) {
      console.error("[upload-participant-invoice] storage error", uploadError);
      return createErrorResponse(uploadError.message || "Erreur de stockage", 500);
    }

    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(filePath);
    const fileUrl = urlData.publicUrl;

    const { error: updateError } = await admin
      .from("training_participants")
      .update({ invoice_file_url: fileUrl })
      .eq("id", participantId);

    if (updateError) {
      console.error("[upload-participant-invoice] db error", updateError);
      await admin.storage.from(BUCKET).remove([filePath]);
      return createErrorResponse(updateError.message || "Erreur de mise à jour", 500);
    }

    return createJsonResponse({ fileUrl });
  } catch (error) {
    console.error("[upload-participant-invoice] unexpected error", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
