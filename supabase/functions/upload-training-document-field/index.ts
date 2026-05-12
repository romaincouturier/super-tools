import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/supabase-client.ts";

const BUCKET = "training-documents";

type TrainingArrayField = "signed_convention_urls" | "attendance_sheets_urls";
type TrainingSingleField = "invoice_file_url";
type TrainingField = TrainingArrayField | TrainingSingleField;

const ARRAY_FIELDS: TrainingArrayField[] = ["signed_convention_urls", "attendance_sheets_urls"];
const ALLOWED_FIELDS: TrainingField[] = [...ARRAY_FIELDS, "invoice_file_url"];

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
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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
    const trainingId = String(form.get("trainingId") || "");
    const field = String(form.get("field") || "") as TrainingField;
    const filterPattern = form.get("filterPattern") ? String(form.get("filterPattern")) : null;
    const file = form.get("file");

    if (!trainingId || !/^[0-9a-f-]{36}$/i.test(trainingId)) {
      return createErrorResponse("trainingId invalide", 400);
    }
    if (!ALLOWED_FIELDS.includes(field)) {
      return createErrorResponse(`field invalide, valeurs acceptées: ${ALLOWED_FIELDS.join(", ")}`, 400);
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
    const sanitizedName = sanitizeFileName(file.name || "document");
    const filePath = `${trainingId}/${field}_${Date.now()}_${sanitizedName}`;

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(filePath, file, { contentType, upsert: false });

    if (uploadError) {
      console.error("[upload-training-document-field] storage error", uploadError);
      return createErrorResponse(uploadError.message || "Erreur de stockage", 500);
    }

    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(filePath);
    const fileUrl = urlData.publicUrl;

    const isArrayField = (ARRAY_FIELDS as string[]).includes(field);
    let updatePayload: Record<string, unknown>;

    if (isArrayField) {
      // Read current array, optionally filter out old entries matching filterPattern, then append
      const { data: trainingData } = await admin
        .from("trainings")
        .select(field)
        .eq("id", trainingId)
        .single();

      let currentUrls: string[] = ((trainingData as Record<string, unknown> | null)?.[field] as string[]) || [];

      if (filterPattern) {
        // Remove old entries matching the pattern (e.g. electronic attendance sheets before replacing)
        const oldToRemove = currentUrls.filter((url) => url.includes(filterPattern));
        for (const oldUrl of oldToRemove) {
          try {
            const oldPath = oldUrl.split("/training-documents/").pop();
            if (oldPath) {
              await admin.storage.from(BUCKET).remove([decodeURIComponent(oldPath)]);
            }
          } catch { /* best-effort */ }
        }
        currentUrls = currentUrls.filter((url) => !url.includes(filterPattern));
      }

      updatePayload = { [field]: [...currentUrls, fileUrl] };
    } else {
      updatePayload = { [field]: fileUrl };
    }

    const { error: updateError } = await admin
      .from("trainings")
      .update(updatePayload)
      .eq("id", trainingId);

    if (updateError) {
      console.error("[upload-training-document-field] db error", updateError);
      await admin.storage.from(BUCKET).remove([filePath]);
      return createErrorResponse(updateError.message || "Erreur de mise à jour", 500);
    }

    return createJsonResponse({ fileUrl, field });
  } catch (error) {
    console.error("[upload-training-document-field] unexpected error", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
