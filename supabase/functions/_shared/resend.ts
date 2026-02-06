/**
 * Resend Email API Module
 *
 * Provides a clean interface for sending emails via Resend API
 */

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "Romain Couturier <romain@supertilt.fr>";

export interface EmailAttachment {
  filename: string;
  content: string; // Base64 encoded
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Send an email via Resend API
 *
 * @param options - Email options
 * @returns Promise<SendEmailResult>
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!resendApiKey) {
    console.error("RESEND_API_KEY not configured");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  const toArray = Array.isArray(options.to) ? options.to : [options.to];

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: options.from || DEFAULT_FROM,
        to: toArray,
        cc: options.cc,
        bcc: options.bcc,
        reply_to: options.replyTo,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Resend API error:", errorText);
      return { success: false, error: `Resend API error: ${response.status}` };
    }

    const data = await response.json();
    console.log("Email sent successfully:", data.id);
    return { success: true, id: data.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending email:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Escape HTML special characters to prevent XSS
 *
 * @param str - String to escape
 * @returns Escaped string safe for HTML insertion
 */
export function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
