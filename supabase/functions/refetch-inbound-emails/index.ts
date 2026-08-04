// Rattrapage : récupère le corps des emails entrants stockés sans contenu
// (les webhooks Resend `email.received` ne transportent que les métadonnées).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

import { extendCorsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { getSupabaseClient, verifyAuth } from "../_shared/supabase-client.ts";
import { fetchReceivedEmailContent } from "../_shared/resend-inbound-content.ts";
import { reportEdgeError } from "../_shared/sentry.ts";

const corsHeaders = extendCorsHeaders({});

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    // Accès admin (JWT) ou maintenance (secret partagé).
    const maintenanceSecret = Deno.env.get("INBOUND_REFETCH_SECRET");
    const providedSecret = req.headers.get("x-refetch-secret");
    const viaSecret = !!maintenanceSecret && providedSecret === maintenanceSecret;

    if (!viaSecret) {
      const user = await verifyAuth(req);
      if (!user) {
        return new Response(JSON.stringify({ error: "Non autorisé" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const authed = getSupabaseClient();
      const { data: isAdmin } = await authed.rpc("is_admin", { _user_id: user.id });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Non autorisé" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }


    const body = await req.json().catch(() => ({}));
    const targetId: string | undefined = body?.id;

    let query = supabase
      .from("inbound_emails")
      .select("id, message_id, text_body, html_body")
      .order("received_at", { ascending: false })
      .limit(50);

    if (targetId) query = supabase
      .from("inbound_emails")
      .select("id, message_id, text_body, html_body")
      .eq("id", targetId);

    const { data: emails, error } = await query;
    if (error) throw error;

    const results: { id: string; updated: boolean; reason?: string }[] = [];

    for (const email of emails || []) {
      if (email.text_body || email.html_body) {
        results.push({ id: email.id, updated: false, reason: "déjà rempli" });
        continue;
      }
      const content = await fetchReceivedEmailContent(email.message_id);
      if (!content || (!content.text && !content.html)) {
        results.push({ id: email.id, updated: false, reason: "contenu indisponible" });
        continue;
      }
      const { error: updateError } = await supabase
        .from("inbound_emails")
        .update({
          text_body: content.text,
          html_body: content.html,
          headers: content.headers,
          attachments: content.attachments,
        })
        .eq("id", email.id);
      results.push({ id: email.id, updated: !updateError, reason: updateError?.message });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    await reportEdgeError(error, { fn: "refetch-inbound-emails" });
    const message = error instanceof Error ? error.message : "Erreur interne";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
