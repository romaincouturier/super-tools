import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSupabaseClient,
  verifyAuth,
} from "../_shared/mod.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";

interface SlackNotifyRequest {
  type: "opportunity_created" | "opportunity_won";
  card: {
    title: string;
    company?: string;
    first_name?: string;
    last_name?: string;
    service_type?: string;
    estimated_value?: number;
    email?: string;
  };
  actor_email?: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function buildSlackMessage(req: SlackNotifyRequest): { text: string; blocks: unknown[] } {
  const { type, card, actor_email } = req;
  const contactName = [card.first_name, card.last_name].filter(Boolean).join(" ");
  const serviceLabel = card.service_type === "formation" ? "Formation" : card.service_type === "mission" ? "Mission" : "";

  if (type === "opportunity_created") {
    const text = `Nouvelle opportunité : ${card.title}`;
    const fields: { type: string; text: string }[] = [];

    if (contactName) fields.push({ type: "mrkdwn", text: `*Contact :* ${contactName}` });
    if (card.company) fields.push({ type: "mrkdwn", text: `*Entreprise :* ${card.company}` });
    if (serviceLabel) fields.push({ type: "mrkdwn", text: `*Type :* ${serviceLabel}` });
    if (card.estimated_value && card.estimated_value > 0) {
      fields.push({ type: "mrkdwn", text: `*Valeur :* ${formatCurrency(card.estimated_value)}` });
    }

    const blocks: unknown[] = [
      {
        type: "header",
        text: { type: "plain_text", text: "🆕 Nouvelle opportunité", emoji: true },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*${card.title}*` },
      },
    ];

    if (fields.length > 0) {
      blocks.push({ type: "section", fields });
    }

    if (actor_email) {
      blocks.push({
        type: "context",
        elements: [{ type: "mrkdwn", text: `Créée par ${actor_email}` }],
      });
    }

    return { text, blocks };
  }

  // opportunity_won
  const text = `Opportunité gagnée : ${card.title}`;
  const fields: { type: string; text: string }[] = [];

  if (contactName) fields.push({ type: "mrkdwn", text: `*Contact :* ${contactName}` });
  if (card.company) fields.push({ type: "mrkdwn", text: `*Entreprise :* ${card.company}` });
  if (serviceLabel) fields.push({ type: "mrkdwn", text: `*Type :* ${serviceLabel}` });
  if (card.estimated_value && card.estimated_value > 0) {
    fields.push({ type: "mrkdwn", text: `*Valeur :* ${formatCurrency(card.estimated_value)}` });
  }

  const blocks: unknown[] = [
    {
      type: "header",
      text: { type: "plain_text", text: "🏆 Opportunité gagnée !", emoji: true },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*${card.title}*` },
    },
  ];

  if (fields.length > 0) {
    blocks.push({ type: "section", fields });
  }

  if (actor_email) {
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: `Marquée gagnée par ${actor_email}` }],
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

    const body: SlackNotifyRequest = await req.json();

    if (!body.type || !body.card) {
      return createErrorResponse("type et card sont requis", 400);
    }

    // Check required env vars for connector gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return createJsonResponse({ success: true, skipped: true, reason: "LOVABLE_API_KEY not configured" });
    }

    const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
    if (!SLACK_API_KEY) {
      return createJsonResponse({ success: true, skipped: true, reason: "SLACK_API_KEY not configured" });
    }

    // Fetch Slack channel from app_settings (fallback to #general)
    const supabase = getSupabaseClient();
    const { data: settings } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "slack_crm_channel")
      .single();

    const channelName = settings?.setting_value || "general";

    const message = buildSlackMessage(body);

    const gatewayHeaders = {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": SLACK_API_KEY,
      "Content-Type": "application/json",
    };

    // Resolve channel name to ID
    const listRes = await fetch(
      `${GATEWAY_URL}/conversations.list?types=public_channel&exclude_archived=true&limit=200`,
      { headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": SLACK_API_KEY } }
    );
    const listData = await listRes.json();
    const channelObj = listData.channels?.find((c: { name: string }) => c.name === channelName);

    if (!channelObj) {
      console.error("Slack channel not found:", channelName);
      return createJsonResponse({ success: false, error: `Canal Slack "${channelName}" introuvable` });
    }

    const channelId = channelObj.id;

    // Auto-join the channel (idempotent)
    const joinRes = await fetch(`${GATEWAY_URL}/conversations.join`, {
      method: "POST",
      headers: gatewayHeaders,
      body: JSON.stringify({ channel: channelId }),
    });
    const joinData = await joinRes.json();
    console.log("conversations.join result:", JSON.stringify(joinData));

    const slackResponse = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
      method: "POST",
      headers: gatewayHeaders,
      body: JSON.stringify({
        channel: channelId,
        text: message.text,
        blocks: message.blocks,
        username: "SuperTools CRM",
        icon_emoji: ":briefcase:",
      }),
    });

    const slackData = await slackResponse.json();

    if (!slackResponse.ok || !slackData.ok) {
      console.error("Slack API error:", slackResponse.status, JSON.stringify(slackData));
      return createJsonResponse({ success: false, error: `Slack error: ${slackData.error || slackResponse.status}` });
    }

    return createJsonResponse({ success: true });
  } catch (error: unknown) {
    console.error("Error sending Slack notification:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur interne";
    return createErrorResponse(errorMessage);
  }
});
