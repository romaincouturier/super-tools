import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { renderCatalogEmail, escapeEmailValue as escE } from "../_shared/editable-email.ts";
import { getSupabaseClient, verifyAuth } from "../_shared/supabase-client.ts";
import { getSenderFrom, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { sendEmail } from "../_shared/resend.ts";
import { emailButton, emailInfoBox } from "../_shared/templates.ts";

import { corsHeaders, handleCorsPreflightIfNeeded, createErrorResponse } from "../_shared/cors.ts";
// Bump this when you deploy to confirm the latest code is running.
const VERSION = "send-content-notification@2026-02-05.1";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);

  if (corsResponse) return corsResponse;

  try {
    // Garde d'auth : destinataire et contenu contrôlés par l'appelant. Sans
    // garde = relais d'email depuis le domaine vérifié. Seuls appelants
    // légitimes : le kanban éditorial et les revues (staff authentifié).
    const authedUser = await verifyAuth(req.headers.get("Authorization"));
    if (!authedUser) return createErrorResponse("Unauthorized", 401);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body", _version: VERSION }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { type, recipientEmail, cardTitle, externalUrl, cardId, authorName, commentText } = body ?? {};
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const { getAppUrls } = await import("../_shared/app-urls.ts");
    const urls = await getAppUrls();
    const APP_URL = urls.app_url;

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    if (!recipientEmail || !type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields", _version: VERSION }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = getSupabaseClient();

    // Fetch BCC settings
    const bccList = await getBccList();

    const normalizedType = String(type)
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");

    console.log(
      `[${VERSION}] notification type=${normalizedType} to=${recipientEmail} cardId=${cardId ?? "(none)"}`
    );

    // Get Signitic signature and sender from
    const signature = await getSigniticSignature();
    const senderFrom = await getSenderFrom();

    let subject = "";
    let htmlContent = "";

    // Build the card link
    const cardLink = cardId ? `${APP_URL}/contenu?card=${cardId}` : `${APP_URL}/contenu`;

    const CONTENT_TYPES: Record<string, { key: string; button: string }> = {
      review_requested: { key: "content_review_requested", button: "Commencer la relecture" },
      review_reminder: { key: "content_review_reminder", button: "Ouvrir la carte" },
      comment_added: { key: "content_comment_added", button: "Voir le commentaire" },
      review_status_changed: { key: "content_review_status_changed", button: "Voir les détails" },
      mention: { key: "content_mention", button: "Voir le commentaire" },
    };
    const ct = CONTENT_TYPES[normalizedType];
    if (!ct) {
      return new Response(
        JSON.stringify({
          error: "Unknown notification type",
          received_type: normalizedType,
          _version: VERSION,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const ctRendered = await renderCatalogEmail(supabase, ct.key, {
      vars: { card_title: cardTitle, author_name: authorName || "Un utilisateur", author_subject: authorName || "Quelqu'un" },
      blocks: {
        card_box: emailInfoBox(`<strong>${escE(cardTitle)}</strong>`),
        external_link: externalUrl ? `<p>Lien externe : <a href="${escE(externalUrl)}">${escE(externalUrl)}</a></p>` : "",
        comment_quote: commentText
          ? `<div style="background-color: #f0f4ff; padding: 15px; border-left: 4px solid #3b82f6; border-radius: 4px; margin: 20px 0;"><p style="margin: 0; color: #1e3a5f; font-style: italic;">"${escE(commentText)}"</p></div>`
          : "",
        card_button: emailButton(ct.button, cardLink),
      },
    });
    subject = ctRendered.subject;
    htmlContent = `${ctRendered.html}${signature}`;

    const result = await sendEmail({
      from: senderFrom,
      to: [recipientEmail],
      bcc: bccList,
      subject,
      html: htmlContent,
      _emailType: "content_notification",
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
    console.error("Error in send-content-notification:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        _version: VERSION,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
