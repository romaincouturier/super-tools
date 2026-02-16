import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSupabaseClient,
  sendEmail,
} from "../_shared/mod.ts";

/**
 * Retry Failed Email
 *
 * Retries sending a previously failed email from the failed_emails table.
 */

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { failedEmailId } = await req.json();

    if (!failedEmailId) {
      return createErrorResponse("failedEmailId is required", 400);
    }

    const supabase = getSupabaseClient();

    // Fetch the failed email
    const { data: failedEmail, error } = await supabase
      .from("failed_emails")
      .select("*")
      .eq("id", failedEmailId)
      .single();

    if (error || !failedEmail) {
      return createErrorResponse("Email not found", 404);
    }

    if (failedEmail.status === "sent") {
      return createErrorResponse("This email has already been sent successfully", 400);
    }

    // Retry sending
    const result = await sendEmail({
      to: [failedEmail.recipient_email],
      subject: failedEmail.subject,
      html: failedEmail.html_content,
    });

    if (!result.success) {
      // Update retry count
      await supabase
        .from("failed_emails")
        .update({
          retry_count: (failedEmail.retry_count || 0) + 1,
          last_retry_at: new Date().toISOString(),
          error_message: result.error || "Unknown error on retry",
        })
        .eq("id", failedEmailId);

      return createErrorResponse(`Retry failed: ${result.error}`, 500);
    }

    // Mark as sent
    await supabase
      .from("failed_emails")
      .update({
        status: "sent",
        retry_count: (failedEmail.retry_count || 0) + 1,
        last_retry_at: new Date().toISOString(),
      })
      .eq("id", failedEmailId);

    return createJsonResponse({ success: true, messageId: result.id });
  } catch (error: unknown) {
    console.error("Error retrying failed email:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to retry email";
    return createErrorResponse(errorMessage);
  }
});
