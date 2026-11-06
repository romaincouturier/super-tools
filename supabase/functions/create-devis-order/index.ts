/**
 * create-devis-order
 *
 * Crée (action "create") ou annule (action "cancel") une commande interne issue
 * d'un devis de jeux gagné. La commande vit dans woocommerce_orders/order_items
 * (source = 'devis', wc_order_id négatif, n° DV-AAAA-NNNN) et suit le même
 * workflow qu'une commande boutique : kanban, game_sales, email auteur/partenaire,
 * location. Aucun appel aux commandes WooCommerce : pas de facture ni de mail compta.
 */
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { getSupabaseClient, verifyAuth } from "../_shared/supabase-client.ts";
import { isStaffCaller } from "../_shared/cron-auth.ts";
import { reportEdgeError } from "../_shared/sentry.ts";
import {
  canCancelDevisOrder,
  devisLineTotal,
  devisOrderTotals,
  devisRoyalty,
  devisSaleKey,
  kanbanStatusForGameType,
} from "../_shared/devis-order.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const UUID_RE = /^[0-9a-f-]{36}$/i;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Address = Record<string, string>;
interface CreateBody {
  action: "create";
  crmCardId: string;
  devisActivityLogId?: string | null;
  customer: { firstName?: string; lastName?: string; email?: string; company?: string };
  billingAddress: Address;
  shippingAddress: Address;
  lines: Array<{ gameId: string; quantity: number; unitPrice: number; discountPercent?: number; isLocation?: boolean }>;
  shippingFee: number;
  adminFee: number;
}
interface CancelBody { action: "cancel"; orderId: string; reason?: string }

function cleanAddress(a: unknown): Address {
  const out: Address = {};
  if (!a || typeof a !== "object") return out;
  for (const k of ["first_name", "last_name", "company", "address_1", "address_2", "postcode", "city", "country", "email", "phone"]) {
    const v = (a as Record<string, unknown>)[k];
    if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 300);
  }
  return out;
}

async function getSettings(admin: any) {
  const { data } = await admin.from("supertilt_settings").select("key, value");
  const get = (k: string) => (data as Array<{ key: string; value: unknown }> | null)?.find((s) => s.key === k)?.value;
  const autoRaw = get("auto_send_emails");
  return {
    autoSend: autoRaw === true || (typeof autoRaw === "string" && autoRaw.replace(/\\?"/g, "").trim() === "true"),
    vatRate: Number(get("vat_rate") ?? 0.2),
    currency: (get("default_currency") as string) ?? "EUR",
  };
}

async function handleCreate(admin: any, user: { id: string; email?: string }, body: CreateBody) {
  if (!UUID_RE.test(body.crmCardId ?? "")) return json({ error: "Opportunité invalide" }, 400);
  if (body.devisActivityLogId && !UUID_RE.test(body.devisActivityLogId)) return json({ error: "Devis invalide" }, 400);
  if (!Array.isArray(body.lines) || body.lines.length === 0 || body.lines.length > 50) return json({ error: "Lignes manquantes" }, 400);
  const shippingFee = Number(body.shippingFee ?? 0);
  const adminFee = Number(body.adminFee ?? 0);
  if (!(shippingFee >= 0) || !(adminFee >= 0)) return json({ error: "Frais invalides" }, 400);

  const { data: card } = await admin.from("crm_cards").select("id, sales_status").eq("id", body.crmCardId).maybeSingle();
  if (!card) return json({ error: "Opportunité introuvable" }, 404);

  const gameIds = [...new Set(body.lines.map((l) => l.gameId))];
  if (!gameIds.every((g) => UUID_RE.test(g))) return json({ error: "Jeu invalide" }, 400);
  const { data: games } = await admin
    .from("games")
    .select("id, title, game_type, woocommerce_product_id, location_variation_id, commission_type, commission_rate, commission_fixed")
    .in("id", gameIds);
  const byId = new Map((games ?? []).map((g: any) => [g.id, g]));

  const settings = await getSettings(admin);
  const seen = new Set<string>();
  const items = [];
  try {
    for (const [idx, l] of body.lines.entries()) {
      const g: any = byId.get(l.gameId);
      if (!g) return json({ error: "Jeu introuvable" }, 400);
      const type = l.isLocation ? "location" : g.game_type;
      const productId = g.woocommerce_product_id ?? -(idx + 1);
      const variation = l.isLocation ? g.location_variation_id ?? null : null;
      const key = `${productId}`;
      if (seen.has(key)) return json({ error: `Le jeu « ${g.title} » apparaît deux fois : regroupez les quantités` }, 400);
      seen.add(key);
      const lineTotal = devisLineTotal({ quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), discountPercent: Number(l.discountPercent ?? 0) });
      items.push({
        wc_product_id: productId,
        wc_variation_id: variation,
        product_name: g.title,
        game_id: g.id,
        game_type: type,
        quantity: Number(l.quantity),
        unit_price: Number(l.unitPrice),
        discount_percent: Number(l.discountPercent ?? 0),
        line_total: lineTotal,
        kanban_status: kanbanStatusForGameType(type),
        name: g.title,
        total: String(lineTotal),
        price: Number(l.unitPrice),
        product_id: productId,
        variation_id: variation,
      });
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Ligne invalide" }, 400);
  }

  const totals = devisOrderTotals(items.map((i) => i.line_total), shippingFee, adminFee, settings.vatRate);
  const billing = cleanAddress(body.billingAddress);
  const shipping = cleanAddress(body.shippingAddress);
  const customer = body.customer ?? {};

  const { data: created, error } = await admin.rpc("create_devis_order", {
    p_order: {
      crm_card_id: body.crmCardId,
      devis_activity_log_id: body.devisActivityLogId ?? "",
      created_by: user.id,
      actor_email: user.email ?? null,
      customer_first_name: customer.firstName?.trim() || billing.first_name || null,
      customer_last_name: customer.lastName?.trim() || billing.last_name || null,
      customer_email: customer.email?.trim() || billing.email || null,
      billing_address: { ...billing, company: customer.company?.trim() || billing.company || undefined },
      shipping_address: shipping,
      total_ht: totals.totalHt,
      total_tax: totals.totalTax,
      total_ttc: totals.totalTtc,
      shipping_total: shippingFee,
      admin_fee: adminFee,
    },
    p_items: items,
  });
  if (error) throw new Error(`create_devis_order: ${error.message}`);
  const result = created as { id: string; order_number: string; existing: boolean };
  if (result.existing) return json({ ok: true, ...result });

  const { data: savedItems } = await admin
    .from("order_items")
    .select("id, game_id, quantity, line_total, unit_price")
    .eq("woocommerce_order_id", result.id)
    .order("created_at", { ascending: true });

  const customerName = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.company || null;
  let emailsQueued = 0;
  for (const [idx, it] of ((savedItems ?? []) as any[]).entries()) {
    const g: any = byId.get(it.game_id);
    const lineHt = Number(it.line_total ?? 0);
    const lineTtc = +(lineHt * (1 + settings.vatRate)).toFixed(2);
    // Facture émise hors boutique : vente « pending », sans frais Stripe. Le trigger décrémente le stock interne.
    const { error: saleErr } = await admin.from("game_sales").upsert({
      game_id: it.game_id,
      woocommerce_order_id: devisSaleKey(result.order_number, idx),
      customer_name: customerName,
      customer_email: customer.email ?? null,
      quantity: it.quantity,
      unit_price: it.quantity > 0 ? +(lineHt / it.quantity).toFixed(2) : lineHt,
      total_amount: lineTtc,
      amount_ht: lineHt,
      vat_amount: +(lineTtc - lineHt).toFixed(2),
      bank_fees: 0,
      net_amount: lineTtc,
      currency: settings.currency,
      royalty_amount: g ? devisRoyalty(g, lineHt, it.quantity) : 0,
      sale_date: new Date().toISOString(),
      status: "pending",
      raw_order: { source: "devis", order_number: result.order_number, crm_card_id: body.crmCardId },
    }, { onConflict: "woocommerce_order_id" });
    if (saleErr) console.error("game_sales upsert failed:", saleErr.message);

    if (settings.autoSend) {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/supertilt-send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ order_item_id: it.id }),
        });
        emailsQueued++;
      } catch (e) {
        console.error("supertilt-send-email failed:", e);
      }
    }
  }

  return json({ ok: true, ...result, emails_queued: emailsQueued, auto_send: settings.autoSend });
}

async function handleCancel(admin: any, user: { id: string; email?: string }, body: CancelBody) {
  if (!UUID_RE.test(body.orderId ?? "")) return json({ error: "Commande invalide" }, 400);
  const { data: order } = await admin
    .from("woocommerce_orders")
    .select("id, source, order_number, crm_card_id, cancelled_at")
    .eq("id", body.orderId)
    .maybeSingle();
  if (!order || order.source !== "devis") return json({ error: "Commande issue d'un devis introuvable" }, 404);
  if (order.cancelled_at) return json({ ok: true, already: true });

  const { data: items } = await admin
    .from("order_items")
    .select("id, game_id, quantity, shipped_confirmed_at, hand_delivered_at, contrat_reference, email_sent_at")
    .eq("woocommerce_order_id", order.id);
  if (!canCancelDevisOrder((items ?? []) as any[])) {
    return json({ error: "Une ligne est déjà expédiée, remise ou sous contrat : passez par un avoir" }, 409);
  }

  const now = new Date().toISOString();
  const reason = (body.reason ?? "").trim().slice(0, 500) || null;
  const { error: upErr } = await admin
    .from("woocommerce_orders")
    .update({ cancelled_at: now, cancelled_by: user.id, cancel_reason: reason, wc_status: "cancelled" })
    .eq("id", order.id)
    .is("cancelled_at", null);
  if (upErr) throw new Error(upErr.message);

  await admin.from("order_items").update({ archived_at: now, notes: `Commande annulée${reason ? ` : ${reason}` : ""}` }).eq("woocommerce_order_id", order.id);

  const saleKeys = ((items ?? []) as any[]).map((_, i) => devisSaleKey(order.order_number, i));
  const { data: sales } = await admin.from("game_sales").select("id, game_id, quantity, woocommerce_order_id").in("woocommerce_order_id", saleKeys);
  for (const s of (sales ?? []) as any[]) {
    if (s.game_id) {
      const { data: g } = await admin.from("games").select("current_stock").eq("id", s.game_id).maybeSingle();
      if (g && g.current_stock !== null) {
        await admin.from("games").update({ current_stock: Number(g.current_stock) + Number(s.quantity) }).eq("id", s.game_id);
      }
    }
  }
  if (saleKeys.length) await admin.from("game_sales").delete().in("woocommerce_order_id", saleKeys);

  const notified = ((items ?? []) as any[]).filter((i) => i.email_sent_at).length;
  if (order.crm_card_id) {
    await admin.from("crm_activity_log").insert({
      card_id: order.crm_card_id,
      action_type: "devis_order_cancelled",
      old_value: order.order_number,
      actor_email: user.email ?? null,
      metadata: { order_id: order.id, reason, removed_sales: sales ?? [], partners_already_notified: notified },
    });
  }
  return json({ ok: true, partners_already_notified: notified });
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;
  try {
    const user = await verifyAuth(req.headers.get("Authorization"));
    if (!user) return json({ error: "Non autorisé" }, 401);
    const allowed = (await isStaffCaller(user, "dropshipping")) || (await isStaffCaller(user, "crm"));
    if (!allowed) return json({ error: "Accès refusé" }, 403);

    const body = await req.json().catch(() => null);
    const admin = getSupabaseClient();
    if (body?.action === "create") return await handleCreate(admin, user, body as CreateBody);
    if (body?.action === "cancel") return await handleCancel(admin, user, body as CancelBody);
    return json({ error: "Action inconnue" }, 400);
  } catch (err) {
    console.error("create-devis-order error:", err);
    await reportEdgeError(err, { fn: "create-devis-order" });
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
