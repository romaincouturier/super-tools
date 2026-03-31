import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSupabaseClient,
  verifyAuth,
} from "../_shared/mod.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";

interface MediaSlackRequest {
  file_count: number;
  source_type: string;
  source_label: string;
  file_names: string[];
  actor_email?: string;
}

const SOURCE_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  mission: { label: "Mission", emoji: "💼" },
  training: { label: "Formation", emoji: "🎓" },
  event: { label: "Événement", emoji: "📅" },
  crm: { label: "Opportunité", emoji: "🤝" },
  content: { label: "Contenu", emoji: "📝" },
  lms: { label: "E-learning", emoji: "💻" },
};

function buildSlackMessage(req: MediaSlackRequest) {
  const sourceInfo = SOURCE_TYPE_LABELS[req.source_type] || { label: req.source_type, emoji: "📎" };
  const plural = req.file_count > 1;
  const text = `${req.file_count} nouveau${plural ? "x" : ""} média${plural ? "s" : ""} ajouté${plural ? "s" : ""} dans ${sourceInfo.label} "${req.source_label}"`;

  const fileList = req.file_names.slice(0, 5).map((n) => `• ${n}`).join("\n");
  const extra = req.file_count > 5 ? `\n_…et ${req.file_count - 5} autre${req.file_count - 5 > 1 ? "s" : ""}_` : "";

  const blocks: unknown[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `📸 Nouveau${plural ? "x" : ""} média${plural ? "s" : ""}`, emoji: true },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*${sourceInfo.emoji} ${sourceInfo.label} :*\n${req.source_label}` },
        { type: "mrkdwn", text: `*Fichier${plural ? "s" : ""} :*\n${req.file_count}` },
      ],
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: fileList + extra },
    },
  ];

  if (req.actor_email) {
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: `Ajouté par ${req.actor_email}` }],
    });
  }

  return { text, blocks };
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    const authResult = await verifyAuth(authHeader);
    if (!authResult) {
      return createErrorResponse("Non autorisé", 401);
    }

    const body: MediaSlackRequest = await req.json();

    if (!body.file_count || !body.source_type || !body.source_label) {
      return createErrorResponse("file_count, source_type et source_label sont requis", 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return createJsonResponse({ success: true, skipped: true, reason: "LOVABLE_API_KEY not configured" });
    }

    const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
    if (!SLACK_API_KEY) {
      return createJsonResponse({ success: true, skipped: true, reason: "SLACK_API_KEY not configured" });
    }

    // Resolve #general channel
    const gatewayHeaders = {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": SLACK_API_KEY,
      "Content-Type": "application/json; charset=utf-8",
    };

    // Resolve channel ID for "general"
    let channelTarget = "#general";
    let cursor = "";
    do {
      const url = new URL(`${GATEWAY_URL}/conversations.list`);
      url.searchParams.set("types", "public_channel");
      url.searchParams.set("exclude_archived", "true");
      url.searchParams.set("limit", "200");
      if (cursor) url.searchParams.set("cursor", cursor);

      const res = await fetch(url.toString(), { headers: gatewayHeaders });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) break;

      const match = data?.channels?.find(
        (c: { name?: string }) => (c.name || "").toLowerCase() === "general",
      );
      if (match?.id) {
        channelTarget = match.id;
        break;
      }
      cursor = data?.response_metadata?.next_cursor || "";
    } while (cursor);

    // Join channel (best effort)
    if (/^(C|G)[A-Z0-9]+$/.test(channelTarget)) {
      await fetch(`${GATEWAY_URL}/conversations.join`, {
        method: "POST",
        headers: gatewayHeaders,
        body: JSON.stringify({ channel: channelTarget }),
      }).catch(() => {});
    }

    const message = buildSlackMessage(body);

    const slackResponse = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
      method: "POST",
      headers: gatewayHeaders,
      body: JSON.stringify({
        channel: channelTarget,
        text: message.text,
        blocks: message.blocks,
        username: "SuperTools Médiathèque",
        icon_emoji: ":camera:",
      }),
    });

    const slackData = await slackResponse.json().catch(() => ({}));

    if (!slackResponse.ok || (slackData as { ok?: boolean }).ok === false) {
      const slackError = (slackData as { error?: string })?.error || `HTTP ${slackResponse.status}`;
      console.error("Slack API error:", slackResponse.status, JSON.stringify(slackData));
      return createJsonResponse({ success: false, error: `Slack error: ${slackError}` });
    }

    return createJsonResponse({ success: true });
  } catch (error: unknown) {
    console.error("Error sending media Slack notification:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur interne";
    return createErrorResponse(errorMessage);
  }
});
