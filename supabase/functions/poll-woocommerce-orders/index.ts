/**
 * poll-woocommerce-orders
 *
 * Cron function — fetches completed WooCommerce orders since the last sync,
 * matches order line items against the games catalog (by woocommerce_product_id),
 * and inserts matching sales into game_sales with computed royalties.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { reportEdgeError } from "../_shared/sentry.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface WCOrder {
  id: number;
  date_created: string;
  billing: { first_name: string; last_name: string; email: string };
  line_items: Array<{
    product_id: number;
    quantity: number;
    price: number;
    total: string;
  }>;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // ── Read config ──────────────────────────────────────────────
    const { data: settingsRows } = await (admin as any)
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["woocommerce_store_url", "woocommerce_consumer_key", "woocommerce_consumer_secret"]);

    const get = (k: string) =>
      (settingsRows as Array<{ setting_key: string; setting_value: string }>)
        ?.find((s) => s.setting_key === k)?.setting_value ?? "";

    const storeUrl = get("woocommerce_store_url");
    const consumerKey = get("woocommerce_consumer_key");
    const consumerSecret = get("woocommerce_consumer_secret");

    if (!storeUrl || !consumerKey || !consumerSecret) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "WooCommerce credentials not fully configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Get cursor ───────────────────────────────────────────────
    const { data: cursorRow } = await (admin as any)
      .from("polling_cursors")
      .select("last_synced_at")
      .eq("source", "woocommerce")
      .single();

    const lastSyncedAt = (cursorRow as { last_synced_at?: string } | null)?.last_synced_at
      ?? new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString(); // 90d default

    // ── Load games catalog ───────────────────────────────────────
    const { data: games } = await (admin as any)
      .from("games")
      .select("id, woocommerce_product_id, author_id")
      .eq("status", "active")
      .not("woocommerce_product_id", "is", null);

    if (!games?.length) {
      await (admin as any).from("polling_cursors").update({ last_synced_at: new Date().toISOString(), status: "idle" }).eq("source", "woocommerce");
      return new Response(
        JSON.stringify({ skipped: true, reason: "No active games with woocommerce_product_id configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const gamesByProductId = new Map(
      (games as Array<{ id: string; woocommerce_product_id: number; author_id: string }>)
        .map((g) => [g.woocommerce_product_id, g]),
    );

    // Load royalty rates per author
    const authorIds = [...new Set((games as Array<{ author_id: string }>).map((g) => g.author_id).filter(Boolean))];
    const { data: authors } = authorIds.length
      ? await (admin as any).from("game_authors").select("id, royalty_rate").in("id", authorIds)
      : { data: [] };
    const royaltyByAuthor = new Map(
      (authors as Array<{ id: string; royalty_rate: number }>).map((a) => [a.id, a.royalty_rate]),
    );

    // ── Fetch WooCommerce orders ─────────────────────────────────
    const auth = btoa(`${consumerKey}:${consumerSecret}`);
    const params = new URLSearchParams({
      status: "completed",
      per_page: "100",
      orderby: "date",
      order: "asc",
      after: lastSyncedAt,
    });

    const wcRes = await fetch(`${storeUrl}/wp-json/wc/v3/orders?${params}`, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!wcRes.ok) {
      throw new Error(`WooCommerce API error: ${wcRes.status} ${await wcRes.text()}`);
    }

    const orders: WCOrder[] = await wcRes.json();
    const results = { orders: orders.length, sales_imported: 0, skipped: 0, errors: 0 };

    for (const order of orders) {
      for (const item of order.line_items) {
        const game = gamesByProductId.get(item.product_id);
        if (!game) continue;

        const orderId = `${order.id}-${item.product_id}`;
        const totalAmount = parseFloat(item.total);
        const royaltyRate = royaltyByAuthor.get(game.author_id) ?? 0.10;
        const royaltyAmount = Math.round(totalAmount * royaltyRate * 100) / 100;

        const { error } = await (admin as any).from("game_sales").insert({
          game_id: game.id,
          woocommerce_order_id: orderId,
          customer_name: `${order.billing.first_name} ${order.billing.last_name}`.trim(),
          customer_email: order.billing.email,
          quantity: item.quantity,
          unit_price: item.price,
          total_amount: totalAmount,
          royalty_amount: royaltyAmount,
          sale_date: order.date_created,
          status: "pending",
          raw_order: { order_id: order.id, billing: order.billing },
        });

        if (error) {
          if (error.code === "23505") { results.skipped++; } // duplicate
          else { console.error("game_sales insert error:", error); results.errors++; }
        } else {
          results.sales_imported++;
        }
      }
    }

    await (admin as any).from("polling_cursors").update({
      last_synced_at: new Date().toISOString(),
      status: "idle",
      last_error: null,
    }).eq("source", "woocommerce");

    return new Response(JSON.stringify({ ok: true, ...results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    await reportEdgeError(err, { fn: "poll-woocommerce-orders" });
    const message = err instanceof Error ? err.message : String(err);
    console.error("poll-woocommerce-orders error:", message);
    await (admin as any).from("polling_cursors")
      .update({ status: "error", last_error: message })
      .eq("source", "woocommerce");
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
