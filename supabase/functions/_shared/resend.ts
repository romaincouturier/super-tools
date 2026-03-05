/**
 * Resend Email API Module
 *
 * Provides a clean interface for sending emails via Resend API.
 * Automatically logs failed emails to the failed_emails table for admin notification.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSenderFrom } from "./email-settings.ts";

const RESEND_API_URL = "https://api.resend.com/emails";

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
  /** Optional context for error logging */
  _trainingId?: string;
  _participantId?: string;
  _emailType?: string;
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Log a failed email to the failed_emails table so the admin is notified.
 * Silently catches its own errors to never break the calling function.
 */
async function logFailure(options: SendEmailOptions, errorMessage: string): Promise<void> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;

    const supabase = createClient(url, key);
    const toArray = Array.isArray(options.to) ? options.to : [options.to];

    await supabase.from("failed_emails").insert({
      recipient_email: toArray.join(", "),
      subject: options.subject,
      html_content: options.html,
      error_message: errorMessage,
      email_type: options._emailType || null,
      training_id: options._trainingId || null,
      participant_id: options._participantId || null,
    });
  } catch (e) {
    console.warn("Could not log failed email:", e);
  }
}

/**
 * Send an email via Resend API
 *
 * On failure, automatically logs the error to the failed_emails table
 * so the admin sees a notification badge in the app header.
 *
 * @param options - Email options
 * @returns Promise<SendEmailResult>
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!resendApiKey) {
    console.error("RESEND_API_KEY not configured");
    await logFailure(options, "RESEND_API_KEY not configured");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  const toArray = Array.isArray(options.to) ? options.to : [options.to];

  try {
    const defaultFrom = await getSenderFrom();
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const response = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: options.from || defaultFrom,
          to: toArray,
          cc: options.cc,
          bcc: options.bcc,
          reply_to: options.replyTo,
          subject: options.subject,
          html: options.html,
          attachments: options.attachments,
        }),
      });

      if (response.status === 429 && attempt < MAX_RETRIES) {
        const delay = 1000 * (attempt + 1); // 1s, 2s, 3s
        console.warn(`Rate limited (429), retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        const errorMessage = `Resend API error: ${response.status} — ${errorText}`;
        console.error(errorMessage);
        await logFailure(options, errorMessage);
        return { success: false, error: `Resend API error: ${response.status}` };
      }

      const data = await response.json();
      console.log("Email sent successfully:", data.id);

      // Auto-log to sent_emails_log for Qualiopi traceability
      try {
        const url = Deno.env.get("SUPABASE_URL");
        const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (url && key) {
          const sb = createClient(url, key);
          await sb.from("sent_emails_log").insert({
            recipient_email: toArray.join(", "),
            cc_emails: options.cc || [],
            subject: options.subject,
            html_content: options.html,
            email_type: options._emailType || null,
            training_id: options._trainingId || null,
            participant_id: options._participantId || null,
            resend_email_id: data.id || null,
          });
        }
      } catch (logErr) {
        console.warn("Could not log sent email:", logErr);
      }

      return { success: true, id: data.id };
    }

    // All retries exhausted (should not reach here, but safety net)
    const errorMessage = "Rate limit exceeded after all retries";
    console.error(errorMessage);
    await logFailure(options, errorMessage);
    return { success: false, error: errorMessage };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending email:", errorMessage);
    await logFailure(options, errorMessage);
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
