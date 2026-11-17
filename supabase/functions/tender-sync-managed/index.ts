import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { hasManagedCronCredential } from "../_shared/cron-auth.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";
import { createErrorResponse, createJsonResponse, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;
  if (!(await hasManagedCronCredential(req))) return createErrorResponse("Unauthorized", 401);
  if (req.method !== "POST") return createErrorResponse("Method not allowed", 405);
  const body = await req.json().catch(() => null);
  if (!body || body.source !== "ted" || Object.keys(body).length !== 1) {
    return createErrorResponse("Source attendue : ted", 400);
  }
  const { data, error } = await getSupabaseClient().functions.invoke("ted-sync", { body: {} });
  if (error) {
    const context = (error as { context?: Response }).context;
    const details = context ? await context.text() : error.message;
    return createErrorResponse(`Relais TED: ${details}`, 502, { fn: "tender-sync-managed" });
  }
  return createJsonResponse(data);
});