/**
 * Shared helper to post a Slack notification when a support ticket has finished
 * being VIP coded (coding_status → "done"). Posts to the channel configured via
 * app_settings `slack_support_channel` (defaults to "supertools").
 */

import { getAppUrls } from "./app-urls.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";

export interface SupportTicketCodedCard {
  ticket_number: string;
  title: string;
  branch_url?: string | null;
}

export async function postTicketCodedToSlack(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  card: SupportTicketCodedCard,
): Promise<void> {
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
    if (!LOVABLE_API_KEY || !SLACK_API_KEY) return;

    const { data: settings } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "slack_support_channel")
      .single();

    const configuredChannel = (settings?.setting_value || "supertools").trim();
    const headers = {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": SLACK_API_KEY,
      "Content-Type": "application/json; charset=utf-8",
    };

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

    const urls = await getAppUrls();
    const ticketUrl = `${urls.app_url}/support?q=${encodeURIComponent(card.ticket_number)}`;

    const blocks: unknown[] = [
      {
        type: "header",
        text: { type: "plain_text", text: "✅ Ticket VIP codé", emoji: true },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*<${ticketUrl}|${card.ticket_number}>* — ${card.title}` },
      },
    ];

    const links = [`<${ticketUrl}|Voir le ticket>`];
    if (card.branch_url) links.push(`<${card.branch_url}|Voir la PR>`);
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: `État : VIP codé · ${links.join(" · ")}` }],
    });

    await fetch(`${GATEWAY_URL}/chat.postMessage`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        channel: channelTarget,
        text: `Ticket VIP codé : ${card.ticket_number} — ${card.title}`,
        blocks,
        username: "SuperTools Support",
        icon_emoji: ":white_check_mark:",
      }),
    });
  } catch (e) {
    console.error("postTicketCodedToSlack (non-fatal):", e);
  }
}
