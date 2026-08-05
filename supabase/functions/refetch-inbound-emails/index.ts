// Rattrapage : récupère le corps des emails entrants stockés sans contenu
// (les webhooks Resend `email.received` ne transportent que les métadonnées).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

import {
  createErrorResponse,
  extendCorsHeaders,
  handleCorsPreflightIfNeeded,
} from "../_shared/cors.ts";
import { getSupabaseClient, verifyAuth } from "../_shared/supabase-client.ts";
import * as inbound from "../_shared/resend-inbound-content.ts";
import { ingestTenderEmailNotices } from "../_shared/tender-email-notices.ts";

const corsHeaders = extendCorsHeaders({});

/**
 * Le corps du mail rend enfin les avis lisibles : on rejoue le filtrage sur
 * son contenu. Une alerte AWS contient une dizaine d'avis, la fiche créée à
 * l'arrivée n'en portait que le sujet.
 */
async function syncTenderBody(
  supabase: ReturnType<typeof getSupabaseClient>,
  email: { id: string; message_id: string | null; subject?: string | null; from_email?: string | null },
  text: string | null,
  html: string | null,
) {
  const body = text || html;
  if (!body) return null;

  return await ingestTenderEmailNotices(supabase, {
    id: email.id,
    messageId: email.message_id,
    subject: email.subject ?? null,
    from: email.from_email ?? null,
    body,
  });
}


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
        return createErrorResponse("Non autorisé", 401, { fn: "refetch-inbound-emails" });
      }
      const authed = getSupabaseClient();
      const { data: isAdmin } = await authed.rpc("is_admin", { _user_id: user.id });
      if (!isAdmin) {
        return createErrorResponse("Non autorisé", 403, { fn: "refetch-inbound-emails" });
      }
    }

    const supabase = getSupabaseClient();
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
        await syncTenderBody(supabase, email.id, email.text_body, email.html_body);
        results.push({ id: email.id, updated: false, reason: "déjà rempli" });
        continue;
      }
      const content = await inbound.fetchReceivedEmailContent(email.message_id);
      if (!content || (!content.text && !content.html)) {
        results.push({
          id: email.id,
          updated: false,
          reason: inbound.lastFetchError ?? "contenu indisponible",
        });
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
      if (!updateError) {
        await syncTenderBody(supabase, email.id, content.text, content.html);
      }
      results.push({ id: email.id, updated: !updateError, reason: updateError?.message });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur interne";
    return createErrorResponse(message, 500, { cause: error, fn: "refetch-inbound-emails" });
  }
});
