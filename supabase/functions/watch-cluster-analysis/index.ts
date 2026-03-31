import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSupabaseClient,
  verifyAuth,
} from "../_shared/mod.ts";

/**
 * Analyze watch items for clusters of related content.
 * When 3+ items are semantically similar, create a cluster and propose a Slack article.
 *
 * This function is designed to be called:
 * - After each new item is processed
 * - On a scheduled basis (e.g., daily cron)
 */
serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const authResult = await verifyAuth(req.headers.get("Authorization"));
    if (!authResult) return createErrorResponse("Non autorisé", 401);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return createJsonResponse({ success: true, skipped: true, reason: "OPENAI_API_KEY not configured" });
    }

    const supabase = getSupabaseClient();

    // Fetch unclustered items with embeddings (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: items, error } = await supabase
      .from("watch_items")
      .select("id, title, body, tags, embedding")
      .is("cluster_id", null)
      .gte("created_at", thirtyDaysAgo)
      .not("embedding", "is", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    if (!items || items.length < 3) {
      return createJsonResponse({ success: true, clusters_created: 0, reason: "Not enough items" });
    }

    // Use OpenAI to identify clusters from the items
    const itemSummaries = items.map((item: { id: string; title: string; body: string; tags: string[] }) => ({
      id: item.id,
      title: item.title,
      tags: item.tags,
      preview: (item.body || "").slice(0, 200),
    }));

    const clusterRes = await fetch("https://api.openai.com/v1/chat/completions", {
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
            content: `Tu es un assistant de veille. Analyse les contenus suivants et identifie des groupes (clusters) de 3+ contenus liés par un même thème.

Pour chaque cluster trouvé, retourne:
- "title": titre du cluster
- "summary": résumé en 2-3 phrases expliquant le lien
- "item_ids": tableau des IDs des contenus liés

Retourne un JSON: { "clusters": [...] }
Si aucun cluster n'est trouvé, retourne: { "clusters": [] }
Retourne UNIQUEMENT le JSON, sans markdown.`,
          },
          { role: "user", content: JSON.stringify(itemSummaries) },
        ],
        max_tokens: 1000,
        temperature: 0.2,
      }),
    });

    if (!clusterRes.ok) {
      throw new Error(`OpenAI error: ${clusterRes.status}`);
    }

    const clusterData = await clusterRes.json();
    const aiContent = clusterData.choices?.[0]?.message?.content || "";

    let parsedClusters: { title: string; summary: string; item_ids: string[] }[] = [];
    try {
      const parsed = JSON.parse(aiContent);
      parsedClusters = parsed.clusters || [];
    } catch {
      console.warn("Failed to parse cluster response:", aiContent);
      return createJsonResponse({ success: true, clusters_created: 0 });
    }

    // Create clusters in the database
    let created = 0;
    for (const cluster of parsedClusters) {
      if (cluster.item_ids.length < 3) continue;

      const { data: newCluster, error: insertError } = await supabase
        .from("watch_clusters")
        .insert({ title: cluster.title, summary: cluster.summary })
        .select()
        .single();

      if (insertError || !newCluster) continue;

      // Assign items to cluster
      await supabase
        .from("watch_items")
        .update({ cluster_id: newCluster.id })
        .in("id", cluster.item_ids);

      created++;

      // Notify Slack about the new cluster
      try {
        await notifySlackCluster(newCluster.id, cluster.title, cluster.summary, cluster.item_ids.length);
      } catch {
        console.warn("Slack notification failed for cluster:", newCluster.id);
      }
    }

    return createJsonResponse({ success: true, clusters_created: created });
  } catch (error: unknown) {
    console.error("Error in cluster analysis:", error);
    const msg = error instanceof Error ? error.message : "Erreur interne";
    return createErrorResponse(msg);
  }
});

async function notifySlackCluster(clusterId: string, title: string, summary: string, itemCount: number) {
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
    }).catch(() => {});
  }

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: `🔍 Veille — Nouveau thème détecté`, emoji: true },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*${title}*\n${summary}` },
    },
    {
      type: "context",
      elements: [
        { type: "mrkdwn", text: `${itemCount} contenus liés • Proposé automatiquement par SuperTools Veille` },
      ],
    },
  ];

  await fetch(`${GATEWAY_URL}/chat.postMessage`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      channel: channelTarget,
      text: `🔍 Veille — Nouveau thème : ${title}`,
      blocks,
      username: "SuperTools Veille",
      icon_emoji: ":mag:",
    }),
  });

  // Mark cluster as posted
  const supabase = getSupabaseClient();
  await supabase
    .from("watch_clusters")
    .update({ slack_posted_at: new Date().toISOString() })
    .eq("id", clusterId);
}
