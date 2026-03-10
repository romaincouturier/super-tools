import { supabase } from "@/integrations/supabase/client";

// Deduplicate Slack notifications: prevent the same notification from being
// sent twice within a short window (e.g. due to multiple mutation paths
// triggering concurrently for the same card status change).
const _recentNotifications = new Map<string, number>();
const DEDUP_WINDOW_MS = 30_000;

export type CrmSlackNotificationType = "opportunity_created" | "opportunity_won";

export interface CrmSlackNotificationCard {
  title: string;
  company?: string;
  first_name?: string;
  last_name?: string;
  service_type?: string;
  estimated_value?: number;
  email?: string;
}

/** Fire-and-forget Slack notification with built-in deduplication. */
export async function notifyCrmSlack(
  type: CrmSlackNotificationType,
  card: CrmSlackNotificationCard,
  actorEmail?: string
) {
  const dedupKey = `${type}:${card.title}`;
  const now = Date.now();
  const lastSent = _recentNotifications.get(dedupKey);
  if (lastSent && now - lastSent < DEDUP_WINDOW_MS) {
    console.log(`[Slack] Skipping duplicate ${type} notification for "${card.title}"`);
    return;
  }
  _recentNotifications.set(dedupKey, now);

  try {
    await supabase.functions.invoke("crm-slack-notify", {
      body: { type, card, actor_email: actorEmail },
    });
  } catch {
    // Silently fail - Slack is non-critical
  }
}
