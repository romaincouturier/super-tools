import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSenderFrom, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { sendEmail } from "../_shared/resend.ts";
import { emailButton, emailInfoBox, emailSuccessBox, wrapEmailHtml } from "../_shared/templates.ts";

const VERSION = "send-support-notification@2026-03-21.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body", _version: VERSION }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { recipientEmail, ticketNumber, ticketTitle, status, resolutionNotes } = body ?? {};

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    if (!recipientEmail || !ticketNumber || !ticketTitle) {
      return new Response(
        JSON.stringify({ error: "Missing required fields", _version: VERSION }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { getAppUrls } = await import("../_shared/app-urls.ts");
    const urls = await getAppUrls();
    const APP_URL = urls.app_url;

    const signature = await getSigniticSignature();
    const senderFrom = await getSenderFrom();
    const bccList = await getBccList();

    const statusLabel = status === "resolu" ? "Résolu" : "Fermé";

    console.log(
      `[${VERSION}] support notification to=${recipientEmail} ticket=${ticketNumber} status=${status}`
    );

    const subject = `${ticketNumber} — Votre demande "${ticketTitle}" a été traitée`;

    const bodyHtml = `
      <p>Bonjour,</p>
      <p>Votre demande de support a été traitée et son statut est maintenant : <strong>${statusLabel}</strong>.</p>
      ${emailInfoBox(`<strong>${ticketNumber} — ${ticketTitle}</strong>`)}
      ${resolutionNotes ? emailSuccessBox("Notes de résolution :", resolutionNotes) : ""}
      <p>Si vous avez des questions, n'hésitez pas à créer un nouveau ticket de support.</p>
      ${emailButton("Voir mes tickets", `${APP_URL}/support`)}
    `;

    const htmlContent = wrapEmailHtml(bodyHtml, signature);

    const result = await sendEmail({
      from: senderFrom,
      to: [recipientEmail],
      bcc: bccList,
      subject,
      html: htmlContent,
      _emailType: "support_notification",
    });

    if (!result.success) {
      console.error("sendEmail error:", result.error);
      return new Response(
        JSON.stringify({ success: false, error: "Email sending failed", _version: VERSION }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, _version: VERSION }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-support-notification:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        _version: VERSION,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
