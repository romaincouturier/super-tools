import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
} from "../_shared/cors.ts";

const BUCKET = "balance-sheets";
const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

    // Path must start with a valid UUID (the user's ID)
    const firstSegment = path.split("/")[0];
    if (!UUID_SEGMENT.test(firstSegment)) {
      return createErrorResponse("Format de chemin invalide", 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { error } = await admin.storage.from(BUCKET).upload(path, file, {
      contentType: "application/pdf",
      upsert: false,
    });

    if (error) {
      console.error("[upload-balance-sheet] storage error", error);
      return createErrorResponse(error.message || "Erreur de stockage", 500);
    }

    const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
    return createJsonResponse({ publicUrl: data.publicUrl, storagePath: path });
  } catch (err) {
    console.error("[upload-balance-sheet] unexpected error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
