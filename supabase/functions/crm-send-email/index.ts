import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  verifyAuth,
  sendEmail,
  getSigniticSignature,
} from "../_shared/mod.ts";
import { getBccSettings } from "../_shared/bcc-settings.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getSenderEmail } from "../_shared/email-settings.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface EmailAttachment {
  filename: string;
  content: string; // Base64 encoded
}

interface CrmSendEmailRequest {
  card_id: string;
  recipient_email: string;
  subject: string;
  body_html: string;
  attachments?: EmailAttachment[];
  cc?: string[];
  bcc?: string[];
}

/**
 * Add inline styles to HTML elements for email client compatibility
 */
function addInlineStyles(html: string): string {
  // Add styles to paragraphs - margin for spacing
  let styledHtml = html.replace(
    /<p>/g,
    '<p style="margin: 0 0 10px 0; line-height: 1.5;">'
  );

  // Add styles to bold
  styledHtml = styledHtml.replace(
    /<strong>/g,
    '<strong style="font-weight: bold;">'
  );

  // Add styles to italic
  styledHtml = styledHtml.replace(
    /<em>/g,
    '<em style="font-style: italic;">'
  );

  // Add styles to underline
  styledHtml = styledHtml.replace(
    /<u>/g,
    '<u style="text-decoration: underline;">'
  );

  // Add styles to links
  styledHtml = styledHtml.replace(
    /<a /g,
    '<a style="color: #0066cc; text-decoration: underline;" '
  );

  // Add styles to unordered lists
  styledHtml = styledHtml.replace(
    /<ul>/g,
    '<ul style="margin: 0 0 10px 0; padding-left: 20px;">'
  );

  // Add styles to ordered lists
  styledHtml = styledHtml.replace(
    /<ol>/g,
    '<ol style="margin: 0 0 10px 0; padding-left: 20px;">'
  );

  // Add styles to list items
  styledHtml = styledHtml.replace(
    /<li>/g,
    '<li style="margin: 0 0 5px 0;">'
  );

  // Handle line breaks (br tags)
  styledHtml = styledHtml.replace(
    /<br\s*\/?>/g,
    '<br style="display: block; margin: 5px 0;">'
  );

  return styledHtml;
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

    const body = await req.json() as CrmSendEmailRequest;
    const { card_id, recipient_email, subject, body_html, attachments, cc, bcc: extraBcc } = body;

    console.log("Request received - attachments present:", !!attachments, "count:", attachments?.length || 0);
    if (attachments && attachments.length > 0) {
      attachments.forEach((a, i) => {
        console.log(`Attachment ${i}: filename="${a.filename}", content length=${a.content?.length || 0}`);
      });
    }

    if (!card_id || !recipient_email || !subject) {
      return createErrorResponse("card_id, recipient_email et subject sont requis", 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get sender email from auth result
    const senderEmail = authResult.email || await getSenderEmail();

    // Get Signitic signature and BCC settings
    const [emailSignature, bccList] = await Promise.all([
      getSigniticSignature(),
      getBccSettings(supabase),
    ]);

    // Process HTML to add inline styles for email compatibility
    const styledBodyHtml = addInlineStyles(body_html);

    // Build complete email HTML with signature
    const completeHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #333333; margin: 0; padding: 0;">
  <div style="max-width: 600px; padding: 20px;">
    ${styledBodyHtml}
    <div style="margin-top: 20px;">
      ${emailSignature}
    </div>
  </div>
</body>
</html>
    `;

    // Merge auto BCC with any extra BCC from the user
    const allBcc = [...bccList];
    if (extraBcc && extraBcc.length > 0) {
      for (const addr of extraBcc) {
        if (addr && !allBcc.includes(addr)) allBcc.push(addr);
      }
    }

    // Send the email using Resend
    const emailResult = await sendEmail({
      to: [recipient_email],
      subject: subject,
      html: completeHtml,
      cc: cc && cc.length > 0 ? cc : undefined,
      bcc: allBcc,
      attachments: attachments,
    });

    if (!emailResult.success) {
      console.error("Email sending failed:", emailResult.error);
      return createErrorResponse(`Échec de l'envoi de l'email: ${emailResult.error}`, 500);
    }

    console.log("Email sent successfully:", emailResult.id);

    // Store attachments in Supabase Storage and persist paths
    const attachmentNames = attachments?.map((a) => a.filename) || [];
    const attachmentPaths: string[] = [];

    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        try {
          const bytes = Uint8Array.from(atob(att.content), (c) => c.charCodeAt(0));
          const safeFilename = att.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
          const storagePath = `emails/${card_id}/${Date.now()}_${safeFilename}`;
          const mimeType = guessMimeType(att.filename);
          const { error: uploadError } = await supabase.storage
            .from("crm-attachments")
            .upload(storagePath, bytes, { contentType: mimeType, upsert: false });
          if (!uploadError) {
            attachmentPaths.push(storagePath);
          } else {
            console.warn("Failed to upload attachment:", att.filename, uploadError);
          }
        } catch (uploadErr) {
          console.warn("Error uploading attachment:", att.filename, uploadErr);
        }
      }
    }

    // Store the email in crm_card_emails
    const { error: insertError } = await supabase.from("crm_card_emails").insert({
      card_id: card_id,
      sender_email: senderEmail,
      recipient_email: recipient_email,
      subject: subject,
      body_html: body_html,
      attachment_names: attachmentNames,
      attachment_paths: attachmentPaths.length > 0 ? attachmentPaths : null,
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
      metadata: { recipient: recipient_email, subject: subject, email_id: emailResult.id, attachments: attachmentNames },
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
