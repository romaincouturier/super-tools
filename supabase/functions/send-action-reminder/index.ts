import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSenderFrom, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { getAppUrls } from "../_shared/app-urls.ts";
import { sendEmail } from "../_shared/resend.ts";

const VERSION = "send-action-reminder@2026-02-02.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const urls = await getAppUrls();
    const APP_URL = urls.app_url;

    if (!RESEND_API_KEY) {
      console.error("[send-action-reminder] Missing RESEND_API_KEY");
      return new Response(
        JSON.stringify({ error: "Email service not configured", _version: VERSION }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch BCC settings
    const bccList = await getBccList();

    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body", _version: VERSION }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { actionId, trainingName, description, assignedEmail, assignedName, trainingId } = body;

    if (!actionId || !assignedEmail || !description) {
      return new Response(
        JSON.stringify({ error: "Missing required fields", _version: VERSION }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const trainingLink = trainingId 
      ? `${APP_URL}/formations/${trainingId}` 
      : `${APP_URL}/formations`;

    const recipientName = assignedName || "";
    const formationLabel = trainingName || "Formation";
    const greeting = recipientName ? `Bonjour ${recipientName},` : "Bonjour,";

    // Get Signitic signature and sender from
    const signature = await getSigniticSignature();
    const senderFrom = await getSenderFrom();

    const htmlContent = `
      <p>${greeting}</p>
      <p>Tu as une action à réaliser dans le cadre de la formation <strong>${formationLabel}</strong> :</p>
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
        <strong>${description}</strong>
      </div>
      <p>Merci de traiter cette action dès que possible.</p>
      <p style="margin: 20px 0;">
        <a href="${trainingLink}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Voir la formation
        </a>
      </p>
      ${signature}
    `;

    console.log(`[${VERSION}] Sending reminder to ${assignedEmail} for action ${actionId}`);

    const response = await sendEmail({
      from: senderFrom,
      to: [assignedEmail],
      bcc: bccList,
      subject: `🔔 Rappel : ${description.substring(0, 50)}${description.length > 50 ? "..." : ""}`,
      html: htmlContent,
      _emailType: "action_reminder",
      _trainingId: trainingId || undefined,
    });

    if (!response.success) {
      console.error("[send-action-reminder] sendEmail error:", response.error);
      return new Response(
        JSON.stringify({ success: false, error: "Email sending failed", _version: VERSION }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the action status to 'sent'
    const { error: updateError } = await supabase
      .from("training_actions")
      .update({ 
        status: "sent",
        reminder_sent_at: new Date().toISOString()
      })
      .eq("id", actionId);

    if (updateError) {
      console.error("[send-action-reminder] Failed to update action status:", updateError);
    }

    return new Response(
      JSON.stringify({ success: true, _version: VERSION }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[send-action-reminder] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        _version: VERSION,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
