import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/supabase-client.ts";
import { resolveContentType } from "../_shared/file-utils.ts";

const BUCKET = "media";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOURCE_TYPES = new Set(["mission", "event", "training", "crm", "content", "lms", "agent"]);

function sanitizeFileName(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  if (req.method !== "POST") return createErrorResponse("Method not allowed", 405);

  try {
    const user = await verifyAuth(req.headers.get("Authorization"));
    if (!user?.id) return createErrorResponse("Authentification requise", 401);

    const form = await req.formData();
    const sourceType = String(form.get("sourceType") || "");
    const sourceId = String(form.get("sourceId") || "");
    const file = form.get("file");

    if (!SOURCE_TYPES.has(sourceType)) return createErrorResponse("Type de source invalide", 400);
    if (sourceType !== "agent" && !UUID_RE.test(sourceId)) return createErrorResponse("Identifiant source invalide", 400);
    if (!(file instanceof File)) return createErrorResponse("Fichier manquant", 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return createErrorResponse("Configuration serveur manquante", 500);

    const admin = createClient(supabaseUrl, serviceKey);
    const safeName = sanitizeFileName(file.name || "media");
    const folder = sourceType === "agent" ? `agent/${user.id}` : `${sourceType}/${sourceId}`;
    const path = `${folder}/${Date.now()}_${safeName}`;
    const contentType = resolveContentType(file);

    const { error } = await admin.storage.from(BUCKET).upload(path, file, { contentType, upsert: false });
    if (error) {
      console.error("[upload-media-file] storage error", error);
      return createErrorResponse(error.message || "Erreur de stockage", 500);
    }

    const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
    return createJsonResponse({ publicUrl: data.publicUrl, path, contentType });
  } catch (error) {
    console.error("[upload-media-file] unexpected error", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});