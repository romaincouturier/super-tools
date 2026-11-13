import { corsHeaders, handleCorsPreflightIfNeeded, createErrorResponse } from "../_shared/cors.ts";
import { isStaffCaller } from "../_shared/cron-auth.ts";

Deno.serve(async (req) => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;
  if (!(await isStaffCaller(req, "transcripts"))) return createErrorResponse("Unauthorized", 403);
  return new Response(JSON.stringify({ error: "Utilisez le contrôle d’exhaustivité pour inventorier puis sélectionner explicitement les réparations, sans notifications." }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
