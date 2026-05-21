import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
} from "../_shared/cors.ts";
import { resolveContentType } from "../_shared/file-utils.ts";

const BUCKET = "lms-content";

// Allowed path prefixes — prevents arbitrary writes to the bucket
const ALLOWED_PREFIXES = new Set([
  "images",
  "videos",
  "files",
  "pdfs",
  "assignments",
  "forum-attachments",
]);

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  if (req.method !== "POST") return createErrorResponse("Method not allowed", 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return createErrorResponse("Configuration serveur manquante", 500);

    const form = await req.formData();
    const file = form.get("file");
    const path = String(form.get("path") || "");

    if (!(file instanceof File)) return createErrorResponse("Fichier manquant", 400);
    if (!path) return createErrorResponse("Chemin manquant", 400);

    // Validate path prefix to prevent arbitrary writes
    const prefix = path.split("/")[0];
    if (!ALLOWED_PREFIXES.has(prefix)) {
      return createErrorResponse(`Préfixe de chemin non autorisé: ${prefix}`, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const contentType = resolveContentType(file);

    const { error } = await admin.storage.from(BUCKET).upload(path, file, {
      contentType,
      upsert: false,
    });

    if (error) {
      console.error("[upload-lms-content] storage error", error);
      return createErrorResponse(error.message || "Erreur de stockage", 500);
    }

    const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
    return createJsonResponse({ publicUrl: data.publicUrl });
  } catch (err) {
    console.error("[upload-lms-content] unexpected error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
