/**
 * Shared helper to post a Slack notification for a new CRM opportunity.
 * Used by webhooks (Elementor, Resend inbound) so manual + automated
 * opportunity creations all post to the same configured channel.
 */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";

export interface CrmSlackOpportunityCard {
  title: string;
  message?: string | null;
  company?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  service_type?: string | null;
  source_label?: string; // e.g. "Formulaire site web", "Email entrant"
}

function truncate(s: string, max = 600): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

export async function postCrmOpportunityToSlack(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  card: CrmSlackOpportunityCard,
): Promise<void> {
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
    if (!LOVABLE_API_KEY || !SLACK_API_KEY) return;

    const { data: settings } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "slack_crm_channel")
      .single();

    const configuredChannel = (settings?.setting_value || "commerce").trim();
    const headers = {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": SLACK_API_KEY,
      "Content-Type": "application/json; charset=utf-8",
    };

    // Resolve channel ID by name when not already an ID
    const isLikelyChannelId = /^(C|G)[A-Z0-9]+$/.test(configuredChannel);
    let channelTarget = configuredChannel;
    if (!isLikelyChannelId) {
      const normalized = configuredChannel.replace(/^#/, "").trim().toLowerCase();
      let cursor = "";
      let resolved: string | null = null;
      do {
        const url = new URL(`${GATEWAY_URL}/conversations.list`);
        url.searchParams.set("types", "public_channel");
        url.searchParams.set("exclude_archived", "true");
        url.searchParams.set("limit", "200");
        if (cursor) url.searchParams.set("cursor", cursor);
        const res = await fetch(url.toString(), { headers });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.ok === false) break;
        const match = data?.channels?.find(
          (c: { id?: string; name?: string; name_normalized?: string }) => {
            const n = (c.name || "").toLowerCase();
            const nn = (c.name_normalized || "").toLowerCase();
            return n === normalized || nn === normalized;
          },
        );
        if (match?.id) { resolved = match.id; break; }
        cursor = data?.response_metadata?.next_cursor || "";
      } while (cursor);
      channelTarget = resolved || (configuredChannel.startsWith("#") ? configuredChannel : `#${configuredChannel}`);
    }

    if (/^(C|G)[A-Z0-9]+$/.test(channelTarget)) {
      await fetch(`${GATEWAY_URL}/conversations.join`, {
        method: "POST",
        headers,
        body: JSON.stringify({ channel: channelTarget }),
      }).catch(() => {});
    }

    const contactName = [card.first_name, card.last_name].filter(Boolean).join(" ");
    const contactLine = [contactName, card.company].filter(Boolean).join(" — ");

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

    if (card.message && card.message.trim()) {
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: truncate(card.message.trim()) },
      });
    }

    if (contactLine) {
      blocks.push({
        type: "context",
        elements: [{ type: "mrkdwn", text: contactLine }],
      });
    }

    if (card.source_label) {
      blocks.push({
        type: "context",
        elements: [{ type: "mrkdwn", text: card.source_label }],
      });
    }

    await fetch(`${GATEWAY_URL}/chat.postMessage`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        channel: channelTarget,
        text: `Nouvelle opportunité : ${card.title}`,
        blocks,
        username: "SuperTools CRM",
        icon_emoji: ":briefcase:",
      }),
    });
  } catch (e) {
    console.error("postCrmOpportunityToSlack (non-fatal):", e);
  }
}
