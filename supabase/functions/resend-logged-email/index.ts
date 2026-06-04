import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSupabaseClient,
  sendEmail,
} from "../_shared/mod.ts";

/**
 * Resend Logged Email
 *
 * Resends an email previously logged in sent_emails_log.
 */
serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { logId, recipientOverride } = await req.json();
    if (!logId) return createErrorResponse("logId is required", 400);

    const supabase = getSupabaseClient();

    const { data: log, error } = await supabase
      .from("sent_emails_log")
      .select("*")
      .eq("id", logId)
      .single();

    if (error || !log) return createErrorResponse("Email log not found", 404);

    const to = recipientOverride || log.recipient_email;

    const result = await sendEmail({
      to: Array.isArray(to) ? to : [to],
      subject: log.subject,
      html: log.html_content,
      cc: log.cc_emails || undefined,
      _emailType: log.email_type || undefined,
      _trainingId: log.training_id || undefined,
      _participantId: log.participant_id || undefined,
    });

    if (!result.success) {
      return createErrorResponse(`Resend failed: ${result.error}`, 500);
    }

    return createJsonResponse({ success: true, messageId: result.id });
  } catch (error: unknown) {
    console.error("Error resending logged email:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to resend email";
    return createErrorResponse(errorMessage);
  }
});
