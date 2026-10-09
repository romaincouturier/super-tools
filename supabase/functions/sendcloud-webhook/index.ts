/**
 * sendcloud-webhook
 *
 * Reçoit les webhooks Sendcloud `parcel_status_changed`. Quand un colis est
 * remis au transporteur, retrouve la commande WooCommerce (order_number, sinon
 * external_order_id = wc_order_id) et rattache au colis les lignes de jeux
 * expédiés par SuperTilt (game_type supertilt ou partner) qu'il contient :
 * passage en "processed", date d'envoi, numéro et lien de suivi.
 *
 * Garde : signature HMAC `Sendcloud-Signature` (secret SENDCLOUD_SECRET_KEY).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createErrorResponse, createJsonResponse } from "../_shared/cors.ts";
import { timingSafeEqualSecret } from "../_shared/crypto.ts";
import {
  isShippedStatus,
  safeTrackingUrl,
  selectShippedLines,
  sendcloudSignature,
  type SendcloudWebhookEvent,
} from "../_shared/sendcloud.ts";

// Jeux expédiés depuis le stock SuperTilt (les jeux dropshipping partent de chez l'auteur)
const SHIPPED_BY_SUPERTILT = ["supertilt", "partner"];
const LOCKED_STATUSES = "(blocked,to_validate)";

const FN = "sendcloud-webhook";

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    const secret = Deno.env.get("SENDCLOUD_SECRET_KEY");
    if (!secret) return createErrorResponse("SENDCLOUD_SECRET_KEY non configuré", 500, { fn: FN });

    const rawBody = await req.text();
    const expected = await sendcloudSignature(rawBody, secret);
    if (!(await timingSafeEqualSecret(req.headers.get("sendcloud-signature"), expected))) {
      return createErrorResponse("Invalid signature", 401);
    }

    let event: SendcloudWebhookEvent;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return createErrorResponse("Invalid JSON body", 400);
    }

    const parcel = event.parcel;
    if (event.action !== "parcel_status_changed" || !parcel) {
      return createJsonResponse({ skipped: true, reason: `action ${event.action}` });
    }
    if (!isShippedStatus(parcel.status)) {
      return createJsonResponse({ skipped: true, reason: `status ${parcel.status?.id ?? parcel.status?.message}` });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const findOrders = async (column: "order_number" | "wc_order_id", value: string | number) => {
      const { data, error } = await admin.from("woocommerce_orders").select("id").eq(column, value).limit(2);
      if (error) throw error;
      if ((data ?? []).length > 1) throw new Error(`Plusieurs commandes WooCommerce avec ${column} = ${value}`);
      return data?.[0] ?? null;
    };

    let order: { id: string } | null = null;
    if (parcel.order_number) order = await findOrders("order_number", String(parcel.order_number));
    const externalId = Number(parcel.external_order_id);
    if (!order && Number.isInteger(externalId) && externalId > 0) order = await findOrders("wc_order_id", externalId);
    if (!order) {
      return createJsonResponse({ matched: false, reason: "order not found", order_number: parcel.order_number ?? null });
    }

    const { data: rows, error: candErr } = await admin
      .from("order_items")
      .select("id, wc_product_id, sendcloud_parcel_id, raw_line_item")
      .eq("woocommerce_order_id", order.id)
      .in("game_type", SHIPPED_BY_SUPERTILT)
      .not("kanban_status", "in", LOCKED_STATUSES)
      .is("archived_at", null);
    if (candErr) throw candErr;

    const candidates = (rows ?? []).map((r) => {
      const lineId = Number((r.raw_line_item as { id?: unknown } | null)?.id);
      return { ...r, wc_line_item_id: Number.isInteger(lineId) ? lineId : null };
    });
    const ids = selectShippedLines(candidates, parcel).map((l) => l.id);

    if (ids.length === 0) {
      console.warn(`[${FN}] colis ${parcel.id} sans ligne SuperTools correspondante (commande ${order.id})`);
      return createJsonResponse({ matched: true, order_id: order.id, lines_updated: 0 });
    }

    const { error: updErr } = await admin
      .from("order_items")
      .update({
        kanban_status: "processed",
        sendcloud_parcel_id: parcel.id,
        tracking_number: parcel.tracking_number ?? null,
        tracking_url: safeTrackingUrl(parcel.tracking_url),
      })
      .in("id", ids)
      .not("kanban_status", "in", LOCKED_STATUSES);
    if (updErr) throw updErr;

    const { error: dateErr } = await admin
      .from("order_items")
      .update({ shipped_confirmed_at: new Date().toISOString() })
      .in("id", ids)
      .is("shipped_confirmed_at", null);
    if (dateErr) throw dateErr;

    return createJsonResponse({ matched: true, order_id: order.id, lines_updated: ids.length });
  } catch (err) {
    return createErrorResponse(err instanceof Error ? err.message : String(err), 500, { cause: err, fn: FN });
  }
});
