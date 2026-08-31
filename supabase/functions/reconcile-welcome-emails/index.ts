import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { reconcileMissingWelcomes } from "../_shared/reconcile-welcomes.ts";

/**
 * Programme les convocations manquantes pour les sessions futures.
 * Appelée depuis l'app quand la date d'une session est renseignée/confirmée,
 * et en filet de sécurité par le cron process-scheduled-emails.
 */
const FUNCTION_VERSION = "1.0.0";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getSupabaseClient();
    const result = await reconcileMissingWelcomes(supabase);
    return new Response(
      JSON.stringify({ success: true, ...result, _version: FUNCTION_VERSION }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[reconcile-welcome-emails]", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});
