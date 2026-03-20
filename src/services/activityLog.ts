import { supabase } from "@/integrations/supabase/client";

/**
 * Log an action to the activity_logs table.
 *
 * Centralises the repeated pattern of inserting into activity_logs
 * that was previously copy-pasted across pages and services.
 */
export async function logActivity(opts: {
  actionType: string;
  recipientEmail: string;
  userId?: string;
  details?: Record<string, unknown>;
}) {
  const { error } = await supabase.from("activity_logs").insert({
    action_type: opts.actionType,
    recipient_email: opts.recipientEmail,
    user_id: opts.userId ?? null,
    details: opts.details ?? null,
  });
  if (error) {
    console.error("[logActivity] Failed:", error.message, opts);
  }
}

/**
 * Schedule an email for future sending.
 *
 * Centralises the repeated pattern of inserting into scheduled_emails
 * across participants, bulk participants, coaching, and live meetings.
 */
export async function scheduleEmail(opts: {
  trainingId: string;
  participantId?: string;
  emailType: string;
  scheduledFor: string; // ISO datetime string
  status?: string;
  errorMessage?: string; // used for extra context like coaching slot ID
}) {
  const { error } = await supabase.from("scheduled_emails").insert({
    training_id: opts.trainingId,
    participant_id: opts.participantId ?? null,
    email_type: opts.emailType,
    scheduled_for: opts.scheduledFor,
    status: opts.status ?? "pending",
    error_message: opts.errorMessage ?? null,
  });
  if (error) {
    console.error("[scheduleEmail] Failed:", error.message, opts);
  }
  return { error };
}

/**
 * Schedule multiple emails at once (bulk insert).
 */
export async function scheduleEmailsBulk(
  emails: Array<{
    training_id: string;
    participant_id?: string;
    email_type: string;
    scheduled_for: string;
    status?: string;
    error_message?: string;
  }>
) {
  if (emails.length === 0) return { error: null };

  const rows = emails.map((e) => ({
    training_id: e.training_id,
    participant_id: e.participant_id ?? null,
    email_type: e.email_type,
    scheduled_for: e.scheduled_for,
    status: e.status ?? "pending",
    error_message: e.error_message ?? null,
  }));

  const { error } = await supabase.from("scheduled_emails").insert(rows);
  if (error) {
    console.error("[scheduleEmailsBulk] Failed:", error.message);
  }
  return { error };
}
