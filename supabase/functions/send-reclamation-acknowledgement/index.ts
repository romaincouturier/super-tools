import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { sendEmail } from "../_shared/resend.ts";
import { renderEditableEmail } from "../_shared/editable-email.ts";
import { EDITABLE_EMAIL_DEFAULTS } from "../_shared/editable-email-defaults.ts";
import { getSenderFrom, getSenderEmail, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { corsHeaders, handleCorsPreflightIfNeeded, createErrorResponse } from "../_shared/cors.ts";
import { acknowledgementBlocker, blockerMessage } from "../_shared/reclamation-acknowledgement.ts";

/**
 * Accusé de réception d'une réclamation (indicateur 31).
 *
 * La fonction ne reçoit que le jeton. Le destinataire n'est jamais fourni par
 * l'appelant : il est lu sur la réclamation que ce jeton désigne. Une page
 * publique peut donc l'appeler sans permettre d'adresser un message à qui que
 * ce soit d'autre que le réclamant.
 */

const VERSION = "send-reclamation-acknowledgement@2026-11-05.1";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { token } = await req.json().catch(() => ({ token: null }));
    if (typeof token !== "string" || token.trim() === "") {
      return createErrorResponse("token is required", 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: reclamation, error } = await supabase
      .from("reclamations")
      .select("id, client_name, client_email, status, date_reclamation, acknowledgement_sent_at")
      .eq("token", token)
      .maybeSingle();

    if (error) throw error;
    if (!reclamation) return createErrorResponse("Reclamation not found", 404);

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
