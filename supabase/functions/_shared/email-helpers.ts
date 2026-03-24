/**
 * Email Helpers
 *
 * Shared utilities for send-* edge functions to reduce boilerplate.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, type EmailAttachment } from "./resend.ts";
import { getSenderFrom, getBccList } from "./email-settings.ts";
import { getSigniticSignature } from "./signitic.ts";
import { processTemplate, textToHtml } from "./templates.ts";

// ───── Template fetching ─────

/**
 * Determine tu/vous template type suffix based on formal address setting.
 */
export function tuVousSuffix(formalAddress: boolean | null | undefined): string {
  return formalAddress === false ? "tu" : "vous";
}

/**
 * Fetch an email template from DB, falling back to provided defaults.
 */
export async function fetchTemplateOrDefault(
  supabase: SupabaseClient,
  templateType: string,
  defaultSubject: string,
  defaultContent: string,
  templateId?: string,
): Promise<{ subject: string; content: string }> {
  if (templateId) {
    const { data } = await supabase
      .from("email_templates")
      .select("subject, html_content")
      .eq("id", templateId)
      .maybeSingle();

    if (data) {
      return { subject: data.subject, content: data.html_content };
    }
  }

  const { data } = await supabase
    .from("email_templates")
    .select("subject, html_content")
    .eq("template_type", templateType)
    .maybeSingle();

  return data
    ? { subject: data.subject, content: data.html_content }
    : { subject: defaultSubject, content: defaultContent };
}

// ───── Email assembly & sending ─────

export interface PreparedEmail {
  to: string[];
  from: string;
  bcc: string[];
  subject: string;
  html: string;
  cc?: string[];
  attachments?: EmailAttachment[];
  _emailType: string;
  _trainingId?: string;
  _participantId?: string;
}

/**
 * Prepare an email: fetch signature + BCC, process template, build HTML.
 *
 * Returns a PreparedEmail ready to be sent with sendEmail().
 * This lets callers tweak the email before sending if needed.
 */
export async function prepareTemplatedEmail(opts: {
  supabase: SupabaseClient;
  to: string;
  templateType: string;
  defaultSubject: string;
  defaultContent: string;
  variables: Record<string, string | boolean | null | undefined>;
  emailType: string;
  trainingId?: string;
  participantId?: string;
  templateId?: string;
  cc?: string[];
  attachments?: EmailAttachment[];
  /** If true, convert plain text content to HTML paragraphs (default: true) */
  convertToHtml?: boolean;
}): Promise<PreparedEmail> {
  const [template, senderFrom, bccList, signatureHtml] = await Promise.all([
    fetchTemplateOrDefault(
      opts.supabase,
      opts.templateType,
      opts.defaultSubject,
      opts.defaultContent,
      opts.templateId,
    ),
    getSenderFrom(),
    getBccList(),
    getSigniticSignature(),
  ]);

  const subject = processTemplate(template.subject, opts.variables, false);
  const contentText = processTemplate(template.content, opts.variables, false);

  const convertToHtml = opts.convertToHtml !== false;
  const bodyHtml = convertToHtml ? textToHtml(contentText) : contentText;
  const html = `${bodyHtml}\n${signatureHtml}`;

  return {
    to: [opts.to],
    from: senderFrom,
    bcc: bccList,
    subject,
    html,
    cc: opts.cc,
    attachments: opts.attachments,
    _emailType: opts.emailType,
    _trainingId: opts.trainingId,
    _participantId: opts.participantId,
  };
}

/**
 * Prepare and send a templated email in one call.
 * Shorthand for prepareTemplatedEmail() + sendEmail().
 */
export async function sendTemplatedEmail(
  opts: Parameters<typeof prepareTemplatedEmail>[0],
) {
  const prepared = await prepareTemplatedEmail(opts);
  return sendEmail(prepared);
}

// ───── Activity logging ─────

/**
 * Log an email activity. Silently catches errors to avoid
 * failing the whole request if logging fails.
 */
export async function logEmailActivity(
  supabase: SupabaseClient,
  actionType: string,
  recipientEmail: string,
  details: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.from("activity_logs").insert({
      action_type: actionType,
      recipient_email: recipientEmail,
      details,
    });
  } catch (err) {
    console.warn("Failed to log email activity:", err);
  }
}
