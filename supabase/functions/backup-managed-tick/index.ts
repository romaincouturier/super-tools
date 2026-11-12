import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { hasManagedCronCredential } from "../_shared/cron-auth.ts";
import { handleCorsPreflightIfNeeded, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";

serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;
  if (!(await hasManagedCronCredential(req))) return createErrorResponse("Unauthorized", 401);
  if (req.method !== "POST") return createErrorResponse("Method not allowed", 405);

  try {
    const body = await req.json();
    if (!body || body.mode !== "tick" || Object.keys(body).length !== 1) {
      return createErrorResponse("Seul le mode tick est autorisé", 400);
    }
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return createErrorResponse("Configuration de sauvegarde indisponible", 500);
    const client = createClient(url, key);
    const { data, error } = await client.functions.invoke("scheduled-backup", { body: { mode: "tick" } });
    if (error) {
      console.error("[backup-managed-tick] Échec du relais de sauvegarde", error.message);
      return createErrorResponse("Échec du relais de sauvegarde", 502);
    }
    console.log("[backup-managed-tick]", JSON.stringify(data));
    return createJsonResponse(data);
  } catch {
    return createErrorResponse("Requête de sauvegarde invalide", 400);
  }
});