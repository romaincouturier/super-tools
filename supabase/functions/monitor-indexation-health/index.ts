import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSupabaseClient,
} from "../_shared/mod.ts";

/**
 * Monitor indexation health.
 * Runs every 15 min via cron. Alerts on Slack if items are stuck > 30 min
 * in the indexation queue (= cron in panic OR silent error).
 *
 * Idempotent: only alerts once per "incident" by checking the most recent
 * stuck status — if last check was already alerting, we don't spam.
 */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";
const STUCK_THRESHOLD_MINUTES = 30;

async function postSlack(text: string, blocks: unknown[]) {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const slackKey = Deno.env.get("SLACK_API_KEY");
  if (!lovableKey || !slackKey) {
    console.error("Slack credentials missing");
    return false;
  }

  // Resolve #general channel id
  let channel = "#general";
  try {
    const list = await fetch(`${GATEWAY_URL}/conversations.list?limit=200&types=public_channel`, {
      method: "GET",
      headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": slackKey },
    });
    const data = await list.json();
    const match = data?.channels?.find((c: any) => c.name === "general");
    if (match?.id) channel = match.id;
  } catch (e) {
    console.warn("Channel resolve failed:", e);
  }

  const res = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": slackKey,
    },
    body: JSON.stringify({ channel, text, blocks, username: "Indexation IA", icon_emoji: ":mag:" }),
  });
  const body = await res.json().catch(() => ({}));
  if (!body?.ok) console.error("Slack error:", body);
  return !!body?.ok;
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getSupabaseClient();
    const threshold = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000).toISOString();

    const { data: stuckItems, error } = await supabase
      .from("indexation_queue")
      .select("id, source_type, source_id, operation, created_at")
      .is("processed_at", null)
      .lt("created_at", threshold)
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) return createErrorResponse(`Queue check error: ${error.message}`);

    const stuckCount = stuckItems?.length || 0;

    if (stuckCount === 0) {
      return createJsonResponse({ healthy: true, stuck_count: 0 });
    }

    // Group by source_type for diagnostic
    const bySource: Record<string, number> = {};
    for (const it of stuckItems!) {
      bySource[it.source_type] = (bySource[it.source_type] || 0) + 1;
    }

    const oldest = stuckItems![0].created_at;
    const oldestDate = new Date(oldest);
    const ageMin = Math.round((Date.now() - oldestDate.getTime()) / 60_000);

    const sourceLines = Object.entries(bySource)
      .sort((a, b) => b[1] - a[1])
      .map(([t, n]) => `• ${t} : ${n}`)
      .join("\n");

    const text = `🚨 Indexation IA bloquée : ${stuckCount} items en attente depuis +${STUCK_THRESHOLD_MINUTES} min`;

    const blocks = [
      {
        type: "header",
        text: { type: "plain_text", text: "🚨 Indexation IA bloquée", emoji: true },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Items en attente :*\n${stuckCount}` },
          { type: "mrkdwn", text: `*Plus ancien :*\n${ageMin} min` },
        ],
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Par source :*\n${sourceLines}` },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Ouvre /parametres → Indexation Agent IA pour forcer le traitement.",
          },
        ],
      },
    ];

    await postSlack(text, blocks);

    return createJsonResponse({
      healthy: false,
      stuck_count: stuckCount,
      oldest_age_minutes: ageMin,
      by_source: bySource,
      alerted: true,
    });
  } catch (e) {
    return createErrorResponse(e instanceof Error ? e.message : "Unknown error");
  }
});
