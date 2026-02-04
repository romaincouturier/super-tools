import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  verifyAuth,
  sendEmail,
  getSigniticSignature,
} from "../_shared/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface CrmSendEmailRequest {
  card_id: string;
  recipient_email: string;
  subject: string;
  body_html: string;
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    const authResult = await verifyAuth(authHeader);

    if (!authResult) {
      return createErrorResponse("Non autorisé", 401);
    }

    const { card_id, recipient_email, subject, body_html } = await req.json() as CrmSendEmailRequest;

    if (!card_id || !recipient_email || !subject) {
      return createErrorResponse("card_id, recipient_email et subject sont requis", 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get sender email from auth result
    const senderEmail = authResult.email || "romain@supertilt.fr";

    // Get Signitic signature
    const emailSignature = await getSigniticSignature();

    // Build complete email HTML with signature
    const completeHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        ${body_html}
        ${emailSignature}
      </div>
    `;

    // Send the email using Resend
    const emailResult = await sendEmail({
      to: [recipient_email],
      from: "Romain Couturier <romain@supertilt.fr>",
      subject: subject,
      html: completeHtml,
      bcc: ["supertilt@bcc.nocrm.io"],
    });

    if (!emailResult.success) {
      console.error("Email sending failed:", emailResult.error);
      return createErrorResponse(`Échec de l'envoi de l'email: ${emailResult.error}`, 500);
    }

    console.log("Email sent successfully:", emailResult.id);

    // Store the email in crm_card_emails
    const { error: insertError } = await supabase.from("crm_card_emails").insert({
      card_id: card_id,
      sender_email: senderEmail,
      recipient_email: recipient_email,
      subject: subject,
      body_html: body_html,
    });

    if (insertError) {
      console.warn("Failed to store email in database:", insertError);
      // Don't fail the request, email was sent
    }

    // Log activity
    const { error: activityError } = await supabase.from("crm_activity_log").insert({
      card_id: card_id,
      action_type: "email_sent",
      old_value: null,
      new_value: `To: ${recipient_email} - ${subject}`,
      metadata: { recipient: recipient_email, subject: subject, email_id: emailResult.id },
      actor_email: senderEmail,
    });

    if (activityError) {
      console.warn("Failed to log activity:", activityError);
    }

    return createJsonResponse({
      success: true,
      message: "Email envoyé avec succès",
      email_id: emailResult.id,
    });
  } catch (error: unknown) {
    console.error("Error in crm-send-email:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    return createErrorResponse(errorMessage);
  }
});
