import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { sendEmail } from "../_shared/resend.ts";
import { renderEditableEmail } from "../_shared/editable-email.ts";
import { EDITABLE_EMAIL_DEFAULTS } from "../_shared/editable-email-defaults.ts";
import { getSenderFrom, getSenderEmail, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { corsHeaders, handleCorsPreflightIfNeeded, createErrorResponse } from "../_shared/cors.ts";
import { acknowledgementBlocker, blockerMessage } from "../_shared/reclamation-acknowledgement.ts";
import { verifyAuth } from "../_shared/supabase-client.ts";

/**
 * Accusé de réception d'une réclamation (indicateur 31).
 *
 * Deux appelants, deux preuves d'appartenance, jamais un destinataire :
 *
 * - le formulaire public présente le **jeton** de la réclamation, qu'il est
 *   seul à connaître ;
 * - l'espace apprenant présente l'**identifiant** et un JWT, et la fonction
 *   vérifie que l'adresse du compte est bien celle du réclamant. Le jeton ne
 *   redescend jamais au navigateur : il permettrait de réécrire la réclamation
 *   après sa prise en charge.
 *
 * Dans les deux cas le destinataire est lu sur la réclamation, jamais fourni.
 */

const VERSION = "send-reclamation-acknowledgement@2026-11-05.1";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    const reclamationId = typeof body?.reclamationId === "string" ? body.reclamationId.trim() : "";

    if (!token && !reclamationId) {
      return createErrorResponse("token or reclamationId is required", 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const columns = "id, client_name, client_email, status, date_reclamation, acknowledgement_sent_at";
    const query = token
      ? supabase.from("reclamations").select(columns).eq("token", token)
      : supabase.from("reclamations").select(columns).eq("id", reclamationId);

    const { data: reclamation, error } = await query.maybeSingle();

    if (error) throw error;
    if (!reclamation) return createErrorResponse("Reclamation not found", 404);

    // Appel par identifiant : seul le réclamant lui-même peut le déclencher.
    // Sans cette garde, l'identifiant d'une réclamation suffirait à faire
    // partir un accusé, et à révéler qu'elle existe.
    if (!token) {
      const user = await verifyAuth(req);
      const caller = (user?.email ?? "").trim().toLowerCase();
      const owner = (reclamation.client_email ?? "").trim().toLowerCase();
      if (!caller || caller !== owner) {
        return createErrorResponse("Forbidden", 403);
      }
    }

    const blocker = acknowledgementBlocker(reclamation);
    if (blocker) {
      // Pas une erreur : un rechargement de la page de confirmation passe ici.
      console.log(`[${VERSION}] accusé non envoyé (${blocker}) pour ${reclamation.id}`);
      return new Response(
        JSON.stringify({ success: false, skipped: blocker, reason: blockerMessage(blocker) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const [signature, senderFrom, senderEmail, bccList] = await Promise.all([
      getSigniticSignature(),
      getSenderFrom(),
      getSenderEmail(),
      getBccList(),
    ]);

    const tpl = EDITABLE_EMAIL_DEFAULTS.reclamation_acknowledgement;
    const email = await renderEditableEmail(supabase, {
      type: "reclamation_acknowledgement",
      defaultSubject: tpl.subject.vous,
      defaultContent: tpl.content.vous,
      vars: {
        client_name: reclamation.client_name || null,
        date_reclamation: formatFrenchDate(reclamation.date_reclamation),
      },
    });

    const result = await sendEmail({
      from: senderFrom,
      to: [reclamation.client_email as string],
      bcc: bccList,
      subject: email.subject,
      html: `${email.html}\n${signature}`,
      replyTo: senderEmail,
      _emailType: "reclamation_acknowledgement",
    });

    if (!result.success) {
      return createErrorResponse(`Failed to send acknowledgement: ${result.error}`, 502);
    }

    // L'horodatage est la preuve attendue par l'indicateur 31. Il est posé
    // après l'envoi : un échec laisse la réclamation renvoyable.
    const { error: stampError } = await supabase
      .from("reclamations")
      .update({ acknowledgement_sent_at: new Date().toISOString() })
      .eq("id", reclamation.id);

    if (stampError) {
      console.error(`[${VERSION}] accusé envoyé mais horodatage échoué`, stampError);
    }

    return new Response(
      JSON.stringify({ success: true, messageId: result.id, _version: VERSION }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error(`[${VERSION}]`, error);
    const message = error instanceof Error ? error.message : "Failed to send acknowledgement";
    return createErrorResponse(message, 500);
  }
});

function formatFrenchDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}
