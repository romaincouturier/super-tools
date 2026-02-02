import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, recipientEmail, cardTitle, externalUrl } = await req.json();
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    if (!recipientEmail || !type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let subject = "";
    let htmlContent = "";

    switch (type) {
      case "review_requested":
        subject = `🔍 Nouvelle demande de relecture : ${cardTitle}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Nouvelle demande de relecture</h2>
            <p>Vous avez reçu une demande de relecture pour le contenu :</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <strong>${cardTitle}</strong>
            </div>
            ${externalUrl ? `<p>Lien externe : <a href="${externalUrl}">${externalUrl}</a></p>` : ""}
            <p>Connectez-vous à SuperTools pour commencer la relecture.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />
            <p style="color: #888; font-size: 12px;">SuperTilt - Gestion de contenu</p>
          </div>
        `;
        break;

      case "comment_added":
        subject = `💬 Nouveau commentaire sur : ${cardTitle}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Nouveau commentaire</h2>
            <p>Un nouveau commentaire a été ajouté sur la relecture :</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <strong>${cardTitle}</strong>
            </div>
            <p>Connectez-vous à SuperTools pour voir le commentaire et répondre.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />
            <p style="color: #888; font-size: 12px;">SuperTilt - Gestion de contenu</p>
          </div>
        `;
        break;

      case "review_status_changed":
        subject = `✅ Statut de relecture modifié : ${cardTitle}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Statut de relecture modifié</h2>
            <p>Le statut de la relecture a été mis à jour pour :</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <strong>${cardTitle}</strong>
            </div>
            <p>Connectez-vous à SuperTools pour voir les détails.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />
            <p style="color: #888; font-size: 12px;">SuperTilt - Gestion de contenu</p>
          </div>
        `;
        break;

      default:
        return new Response(
          JSON.stringify({ error: "Unknown notification type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "SuperTilt <notifications@supertilt.fr>",
        to: [recipientEmail],
        subject,
        html: htmlContent,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Resend error:", response.status, errorText);
      // Don't fail the whole operation if email fails
      return new Response(
        JSON.stringify({ success: false, error: "Email sending failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-content-notification:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
