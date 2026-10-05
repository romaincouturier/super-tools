import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { renderCatalogEmail, escapeEmailValue as escE } from "../_shared/editable-email.ts";
import { getSenderFrom, getBccList } from "../_shared/email-settings.ts";
import { sendEmail } from "../_shared/resend.ts";

import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { formType, token, errorMessage, userAgent, url } = await req.json();

    if (!formType || !errorMessage) {
      return new Response(
        JSON.stringify({ error: "formType and errorMessage are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bccList = await getBccList();
    if (!bccList || bccList.length === 0) {
      console.log("[alert-form-error] No BCC recipients configured, skipping alert.");
      return new Response(
        JSON.stringify({ success: true, skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const senderFrom = await getSenderFrom();
    const formLabel = formType === "besoins" ? "Recueil des besoins" : "Évaluation";
    const emoji = "🚨";
    const now = new Date();
    const formattedDate = now.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    const formattedTime = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

    const { getSupabaseClient } = await import("../_shared/supabase-client.ts");
    const rendered = await renderCatalogEmail(getSupabaseClient(), "form_error_alert", {
      vars: { form_label: formLabel },
      blocks: {
        error_details: `<div style="background-color: #fef2f2; border-left: 4px solid #b91c1c; padding: 16px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Type de formulaire :</strong> ${formLabel}</p>
            ${token ? `<p style="margin: 8px 0 0;"><strong>Token :</strong> <code>${escE(token)}</code></p>` : ""}
            <p style="margin: 8px 0 0;"><strong>Erreur :</strong> ${escE(errorMessage)}</p>
            <p style="margin: 8px 0 0;"><strong>Date :</strong> ${formattedDate} à ${formattedTime}</p>
            ${url ? `<p style="margin: 8px 0 0;"><strong>URL :</strong> ${escE(url)}</p>` : ""}
            ${userAgent ? `<p style="margin: 8px 0 0;"><strong>Navigateur :</strong> ${escE(userAgent)}</p>` : ""}
          </div>`,
      },
    });
    await sendEmail({
      from: senderFrom,
      to: bccList,
      subject: rendered.subject,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px;">${rendered.html}</div>`,
      _emailType: "form_error_alert",
    });

    console.log(`[alert-form-error] Alert sent for ${formType} form error`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[alert-form-error] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
