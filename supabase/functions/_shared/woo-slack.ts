/**
 * Shared helper to post a WooCommerce sale notification to Slack.
 * Replaces the "Slack for WooCommerce" WordPress plugin: the SuperTools
 * webhook already receives every order, so the message is built here.
 *
 * Channel: app_settings.slack_ecommerce_channel (defaults to "ecommerce").
 * Idempotent: the caller passes the woocommerce_orders row id and the helper
 * stamps slack_notified_at so an order.updated webhook never re-posts.
 */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";

export interface WooSlackLineItem {
  name: string;
  quantity: number;
  total: string;
}

export interface WooSlackOrder {
  id: number;
  number: string;
  status: string;
  billing?: { first_name?: string; last_name?: string; email?: string; company?: string };
  total?: string;
  shipping_total?: string;
  line_items?: WooSlackLineItem[];
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Attente paiement",
  "on-hold": "En attente",
  processing: "En cours",
  completed: "Terminée",
  cancelled: "Annulée",
  refunded: "Remboursée",
  failed: "Échouée",
};

function euros(value: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

function num(v: string | number | undefined | null): number {
  return typeof v === "number" ? v : parseFloat(String(v ?? "0")) || 0;
}

async function resolveChannel(
  channel: string,
  headers: Record<string, string>,
): Promise<string> {
  if (/^(C|G)[A-Z0-9]+$/.test(channel)) return channel;
  const normalized = channel.replace(/^#/, "").trim().toLowerCase();
  let cursor = "";
  do {
    const url = new URL(`${GATEWAY_URL}/conversations.list`);
    url.searchParams.set("types", "public_channel");
    url.searchParams.set("exclude_archived", "true");
    url.searchParams.set("limit", "200");
    if (cursor) url.searchParams.set("cursor", cursor);
    const res = await fetch(url.toString(), { headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) break;
    const match = data?.channels?.find((c: { id?: string; name?: string; name_normalized?: string }) => {
      const n = (c.name || "").toLowerCase();
      const nn = (c.name_normalized || "").toLowerCase();
      return n === normalized || nn === normalized;
    });
    if (match?.id) return match.id;
    cursor = data?.response_metadata?.next_cursor || "";
  } while (cursor);
  return normalized ? `#${normalized}` : channel;
}

export function buildWooSlackMessage(
  order: WooSlackOrder,
  storeUrl?: string | null,
): { text: string; blocks: unknown[] } {
  const customer = [order.billing?.first_name, order.billing?.last_name].filter(Boolean).join(" ") ||
    order.billing?.email || "Client inconnu";
  const items = order.line_items ?? [];
  const total = num(order.total);
  const shipping = num(order.shipping_total);
  const statusLabel = STATUS_LABELS[order.status] ?? order.status;

  const itemLines = items.map((i) => `• ${i.name} × ${i.quantity} — ${euros(num(i.total))}`);
  if (shipping > 0) itemLines.push(`• Livraison — ${euros(shipping)}`);

  const text = `Nouvelle vente #${order.number} — ${customer} — ${euros(total)}`;

  const blocks: unknown[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `🛒 Nouvelle vente #${order.number}`, emoji: true },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Client :*\n${customer}` },
        { type: "mrkdwn", text: `*Total :*\n${euros(total)}` },
        { type: "mrkdwn", text: `*Statut :*\n${statusLabel}` },
        { type: "mrkdwn", text: `*Articles :*\n${items.reduce((s, i) => s + (i.quantity || 0), 0)}` },
      ],
    },
  ];

  if (itemLines.length > 0) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: itemLines.join("\n") },
    });
  }

  const contextParts: string[] = [];
  if (order.billing?.company) contextParts.push(order.billing.company);
  if (order.billing?.email) contextParts.push(order.billing.email);
  if (storeUrl) {
    const base = storeUrl.replace(/\/$/, "");
    contextParts.push(`<${base}/wp-admin/post.php?post=${order.id}&action=edit|Voir la commande>`);
  }
  if (contextParts.length > 0) {
    blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: contextParts.join("  •  ") }] });
  }

  return { text, blocks };
}

export async function postWooOrderToSlack(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  order: WooSlackOrder,
  woocommerceOrderId: string,
): Promise<void> {
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
    if (!LOVABLE_API_KEY || !SLACK_API_KEY) return;

    // Idempotence: claim the notification slot before posting.
    const { data: claimed } = await supabase
      .from("woocommerce_orders")
      .update({ slack_notified_at: new Date().toISOString() })
      .eq("id", woocommerceOrderId)
      .is("slack_notified_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed) return;

    const { data: settings } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["slack_ecommerce_channel", "woocommerce_store_url"]);

    const map = new Map(
      ((settings ?? []) as Array<{ setting_key: string; setting_value: string | null }>)
        .map((s) => [s.setting_key, (s.setting_value || "").replace(/^"|"$/g, "").trim()]),
    );

    const channel = map.get("slack_ecommerce_channel") || "ecommerce";
    const storeUrl = map.get("woocommerce_store_url") || null;

    const headers = {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": SLACK_API_KEY,
      "Content-Type": "application/json; charset=utf-8",
    };

    const channelTarget = await resolveChannel(channel, headers);

    if (/^(C|G)[A-Z0-9]+$/.test(channelTarget)) {
      await fetch(`${GATEWAY_URL}/conversations.join`, {
        method: "POST",
        headers,
        body: JSON.stringify({ channel: channelTarget }),
      }).catch(() => {});
    }

    const message = buildWooSlackMessage(order, storeUrl);

    const res = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        channel: channelTarget,
        text: message.text,
        blocks: message.blocks,
        username: "SuperTilt Boutique",
        icon_emoji: ":shopping_trolley:",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      console.error("postWooOrderToSlack failed:", res.status, JSON.stringify(data));
      // Release the slot so a later webhook can retry.
      await supabase
        .from("woocommerce_orders")
        .update({ slack_notified_at: null })
        .eq("id", woocommerceOrderId);
    }
  } catch (e) {
    console.error("postWooOrderToSlack (non-fatal):", e);
  }
}
