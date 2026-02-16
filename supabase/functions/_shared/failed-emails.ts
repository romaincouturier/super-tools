/**
 * Failed Emails Logger
 *
 * Utility to log failed email sends to the failed_emails table
 * for later visualization and retry.
 */

interface LogFailedEmailParams {
  supabase: any;
  recipientEmail: string;
  subject: string;
  htmlContent: string;
  errorMessage: string;
  emailType?: string;
  trainingId?: string;
  participantId?: string;
}

export async function logFailedEmail(params: LogFailedEmailParams): Promise<void> {
  try {
    await params.supabase.from("failed_emails").insert({
      training_id: params.trainingId || null,
      participant_id: params.participantId || null,
      recipient_email: params.recipientEmail,
      subject: params.subject,
      html_content: params.htmlContent,
      error_message: params.errorMessage,
      email_type: params.emailType || null,
    });
    console.log(`Failed email logged for ${params.recipientEmail}: ${params.errorMessage}`);
  } catch (logError) {
    console.error("Failed to log email error:", logError);
  }
}
