import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/supabase-client.ts";

const BUCKET = "admin-archives";

type AnalysisPayload = {
  documentId: string;
  filePath: string;
  mimeType: string;
  fileName: string;
};

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
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
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

async function triggerAnalysisInBackground(
  admin: ReturnType<typeof createClient>,
  payload: AnalysisPayload,
  supabaseUrl: string,
  serviceKey: string,
) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/analyze-admin-document`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      throw new Error(`Analysis failed with ${response.status}: ${details}`);
    }
  } catch (error) {
    console.error("[upload-admin-document] analysis trigger failed", error);
    await admin.from("admin_documents").update({ analysis_status: "failed" }).eq("id", payload.documentId);
  }
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
    const file = form.get("file");

    if (!(file instanceof File)) {
      return createErrorResponse("Fichier manquant", 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return createErrorResponse("Configuration serveur manquante", 500);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const sanitizedName = sanitizeFileName(file.name || "document");
    const contentType = resolveContentType(file);
    const path = `documents/${Date.now()}_${sanitizedName}`;

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, file, { contentType, upsert: false });

    if (uploadError) {
      console.error("[upload-admin-document] storage error", uploadError);
      return createErrorResponse(uploadError.message || "Erreur de stockage", 500);
    }

    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);

    const { data: document, error: insertError } = await admin
      .from("admin_documents")
      .insert({
        file_url: urlData.publicUrl,
        file_name: file.name || sanitizedName,
        file_size: file.size,
        mime_type: contentType,
        analysis_status: "pending",
      })
      .select("id, file_url, file_name, file_size, mime_type, year, category, tags, summary, analysis_status, uploaded_at, analyzed_at")
      .single();

    if (insertError) {
      console.error("[upload-admin-document] db error", insertError);
      await admin.storage.from(BUCKET).remove([path]);
      return createErrorResponse(insertError.message || "Erreur d'enregistrement", 500);
    }

    const analysisJob = triggerAnalysisInBackground(
      admin,
      {
        documentId: document.id,
        filePath: path,
        mimeType: contentType,
        fileName: file.name || sanitizedName,
      },
      supabaseUrl,
      serviceKey,
    );
    const edgeRuntime = (globalThis as typeof globalThis & { EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void } }).EdgeRuntime;
    edgeRuntime?.waitUntil(analysisJob);

    return createJsonResponse({ document, filePath: path, mimeType: contentType, fileName: file.name || sanitizedName });
  } catch (error) {
    console.error("[upload-admin-document] unexpected error", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
