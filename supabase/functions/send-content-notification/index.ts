import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSenderFrom, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { sendEmail } from "../_shared/resend.ts";

// Bump this when you deploy to confirm the latest code is running.
const VERSION = "send-content-notification@2026-02-05.1";

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    switch (normalizedType) {
      case "review_requested":
        subject = `🔍 Nouvelle demande de relecture : ${cardTitle}`;
        htmlContent = `
          <p>Bonjour,</p>
          <p>Tu as reçu une demande de relecture pour le contenu :</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <strong>${cardTitle}</strong>
          </div>
          ${externalUrl ? `<p>Lien externe : <a href="${externalUrl}">${externalUrl}</a></p>` : ""}
          <p style="margin: 20px 0;">
            <a href="${cardLink}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Commencer la relecture
            </a>
          </p>
          ${signature}
        `;
        break;

      case "review_reminder":
        subject = `🔔 Rappel — relecture attendue : ${cardTitle}`;
        htmlContent = `
          <p>Bonjour,</p>
          <p>Petit rappel courtois : une relecture est toujours en attente sur :</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <strong>${cardTitle}</strong>
          </div>
          <p>Si tu es disponible, merci de traiter cette relecture dès que possible. Si ce n'est pas le bon moment, un simple retour (même bref) nous aide à nous organiser.</p>
          <p style="margin: 20px 0;">
            <a href="${cardLink}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Ouvrir la carte
            </a>
          </p>
          ${signature}
        `;
        break;

      case "comment_added":
        subject = `💬 Nouveau commentaire sur : ${cardTitle}`;
        htmlContent = `
          <p>Bonjour,</p>
          <p>Un nouveau commentaire a été ajouté sur la relecture :</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <strong>${cardTitle}</strong>
          </div>
          <p style="margin: 20px 0;">
            <a href="${cardLink}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Voir le commentaire
            </a>
          </p>
          ${signature}
        `;
        break;

      case "review_status_changed":
        subject = `✅ Statut de relecture modifié : ${cardTitle}`;
        htmlContent = `
          <p>Bonjour,</p>
          <p>Le statut de la relecture a été mis à jour pour :</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <strong>${cardTitle}</strong>
          </div>
          <p style="margin: 20px 0;">
            <a href="${cardLink}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Voir les détails
            </a>
          </p>
          ${signature}
        `;
        break;

      case "mention":
        subject = `💬 ${authorName || "Quelqu'un"} vous a mentionné — ${cardTitle}`;
        htmlContent = `
          <p>Bonjour,</p>
          <p><strong>${authorName || "Un utilisateur"}</strong> vous a mentionné dans un commentaire sur :</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <strong>${cardTitle}</strong>
          </div>
          ${commentText ? `
          <div style="background-color: #f0f4ff; padding: 15px; border-left: 4px solid #3b82f6; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0; color: #1e3a5f; font-style: italic;">"${commentText}"</p>
          </div>
          ` : ""}
          <p style="margin: 20px 0;">
            <a href="${cardLink}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Voir le commentaire
            </a>
          </p>
          ${signature}
        `;
        break;

      default:
        return new Response(
          JSON.stringify({
            error: "Unknown notification type",
            received_type: normalizedType,
            _version: VERSION,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

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
