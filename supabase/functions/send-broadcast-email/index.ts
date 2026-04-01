import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSupabaseClient,
  sendEmail,
  textToHtml,
} from "../_shared/mod.ts";

import { getSenderFrom, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { trainingId, subject, content } = await req.json();

    if (!trainingId || !subject || !content) {
      return createErrorResponse("trainingId, subject et content sont requis", 400);
    }

    const supabase = getSupabaseClient();

    // Fetch participants
    const { data: participants, error: pError } = await supabase
      .from("training_participants")
      .select("id, email, first_name, last_name")
      .eq("training_id", trainingId);

    if (pError || !participants || participants.length === 0) {
      return createErrorResponse("Aucun participant trouvé", 404);
    }

    // Fetch sender info, BCC, and signature in parallel
    const [senderFrom, bccList, signatureHtml] = await Promise.all([
      getSenderFrom(),
      getBccList(),
      getSigniticSignature(),
    ]);

    const results: { email: string; success: boolean }[] = [];

    for (const participant of participants) {
      // Replace {{first_name}} in subject and content
      const firstName = participant.first_name || "";
      const displayName = [participant.first_name, participant.last_name].filter(Boolean).join(" ");

      const personalizedSubject = subject
        .replace(/\{\{first_name\}\}/g, firstName)
        .replace(/\{\{display_name\}\}/g, displayName);

      const personalizedContent = content
        .replace(/\{\{first_name\}\}/g, firstName)
        .replace(/\{\{display_name\}\}/g, displayName);

      const bodyHtml = textToHtml(personalizedContent);
      const html = `${bodyHtml}\n${signatureHtml}`;

      const result = await sendEmail({
        to: [participant.email],
        from: senderFrom,
        bcc: bccList,
        subject: personalizedSubject,
        html,
      });

      results.push({ email: participant.email, success: result.success });

      if (!result.success) {
        console.error("Failed to send to", participant.email, result.error);
      }

      // Rate limit: 400ms between sends
      await new Promise((r) => setTimeout(r, 400));
    }

    // Log activity
    try {
      await supabase.from("activity_logs").insert({
        action_type: "broadcast_email_sent",
        recipient_email: participants.map((p: { email: string }) => p.email).join(", "),
        details: {
          training_id: trainingId,
          subject,
          recipient_count: participants.length,
          success_count: results.filter((r) => r.success).length,
        },
      });
    } catch (logErr) {
      console.error("Failed to log broadcast activity:", logErr);
    }

    const successCount = results.filter((r) => r.success).length;

    return createJsonResponse({
      success: true,
      recipientCount: successCount,
      totalParticipants: participants.length,
    });
  } catch (error) {
    console.error("Error in send-broadcast-email:", error);
    return createErrorResponse(error instanceof Error ? error.message : "Internal server error", 500);
  }
});
