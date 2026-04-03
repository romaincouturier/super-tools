import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSupabaseClient,
  verifyAuth,
} from "../_shared/mod.ts";
import { getOpenAIApiKey } from "../_shared/api-keys.ts";

/**
 * Generate a weekly digest of the best watch items and post it to Slack.
 * Designed to run every Monday via cron.
 */
serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    // Allow both authenticated calls and cron calls (no auth header for cron)
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const authResult = await verifyAuth(authHeader);
      if (!authResult) return createErrorResponse("Non autorisé", 401);
    }

    const OPENAI_API_KEY = await getOpenAIApiKey();
    if (!OPENAI_API_KEY) {
      return createJsonResponse({ success: true, skipped: true, reason: "OPENAI_API_KEY not configured" });
    }

    const supabase = getSupabaseClient();

    // Calculate week range (last Monday to Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) - 7);
    lastMonday.setHours(0, 0, 0, 0);

    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    lastSunday.setHours(23, 59, 59, 999);

    const weekStart = lastMonday.toISOString().split("T")[0];
    const weekEnd = lastSunday.toISOString().split("T")[0];

    // Check if digest already exists for this week
    const { data: existingDigest } = await supabase
      .from("watch_digests")
      .select("id")
      .eq("week_start", weekStart)
      .limit(1);

    if (existingDigest && existingDigest.length > 0) {
      return createJsonResponse({ success: true, skipped: true, reason: "Digest already exists for this week" });
    }

    // Fetch items from last week, ordered by relevance
    const { data: items, error } = await supabase
      .from("watch_items")
      .select("id, title, body, content_type, tags, relevance_score, source_url")
      .gte("created_at", lastMonday.toISOString())
      .lte("created_at", lastSunday.toISOString())
      .order("relevance_score", { ascending: false })
      .limit(20);

    if (error) throw error;
    if (!items || items.length === 0) {
      return createJsonResponse({ success: true, skipped: true, reason: "No items this week" });
    }

    // Generate summary with OpenAI
    const itemSummaries = items.map((item: { title: string; body: string; tags: string[]; content_type: string }) => ({
      title: item.title,
      tags: item.tags,
      type: item.content_type,
      preview: (item.body || "").slice(0, 300),
    }));

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Tu es un rédacteur de newsletter de veille technologique. Génère un digest hebdomadaire synthétique et engageant à partir des contenus suivants.

Structure:
1. Introduction (1 phrase)
2. Les découvertes clés de la semaine (bullets avec emoji)
3. Tendances observées (1-2 phrases)

Style: professionnel mais accessible, en français. Max 500 mots.`,
          },
          { role: "user", content: JSON.stringify(itemSummaries) },
        ],
        max_tokens: 800,
        temperature: 0.5,
      }),
    });

    if (!aiRes.ok) {
      throw new Error(`OpenAI error: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const summary = aiData.choices?.[0]?.message?.content || "Pas de résumé disponible.";

    const itemIds = items.map((i: { id: string }) => i.id);

    // Save digest
    const { data: digest, error: insertError } = await supabase
      .from("watch_digests")
      .insert({
        week_start: weekStart,
        week_end: weekEnd,
        summary,
        item_ids: itemIds,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Post to Slack
    try {
      await postDigestToSlack(summary, weekStart, weekEnd, items.length, digest.id);
    } catch (e) {
      console.warn("Slack digest notification failed:", e);
    }

    return createJsonResponse({ success: true, digest_id: digest.id, item_count: items.length });
  } catch (error: unknown) {
    console.error("Error generating weekly digest:", error);
    const msg = error instanceof Error ? error.message : "Erreur interne";
    return createErrorResponse(msg);
  }
});

async function postDigestToSlack(summary: string, weekStart: string, weekEnd: string, itemCount: number, digestId: string) {
  const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");

  if (!LOVABLE_API_KEY || !SLACK_API_KEY) return;

  const headers = {
    "Authorization": `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": SLACK_API_KEY,
    "Content-Type": "application/json; charset=utf-8",
  };

  // Find #general channel
  let channelTarget = "#general";
  const listRes = await fetch(`${GATEWAY_URL}/conversations.list?types=public_channel&exclude_archived=true&limit=200`, {
    headers,
  });
  if (listRes.ok) {
    const data = await listRes.json();
    const match = data?.channels?.find((c: { name?: string }) => (c.name || "").toLowerCase() === "general");
    if (match?.id) channelTarget = match.id;
  }

  if (/^(C|G)[A-Z0-9]+$/.test(channelTarget)) {
    await fetch(`${GATEWAY_URL}/conversations.join`, {
      method: "POST",
      headers,
      body: JSON.stringify({ channel: channelTarget }),
    }).catch((err) => console.error("Slack conversations.join failed:", err));
  }

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: `📰 Digest Veille — Semaine du ${weekStart}`, emoji: true },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: summary },
    },
    {
      type: "context",
      elements: [
        { type: "mrkdwn", text: `${itemCount} contenus analysés • ${weekStart} → ${weekEnd}` },
      ],
    },
  ];

  await fetch(`${GATEWAY_URL}/chat.postMessage`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      channel: channelTarget,
      text: `📰 Digest Veille — Semaine du ${weekStart} au ${weekEnd}`,
      blocks,
      username: "SuperTools Veille",
      icon_emoji: ":newspaper:",
    }),
  });

  // Mark digest as posted
  const supabase = getSupabaseClient();
  await supabase
    .from("watch_digests")
    .update({ slack_posted_at: new Date().toISOString() })
    .eq("id", digestId);
}
