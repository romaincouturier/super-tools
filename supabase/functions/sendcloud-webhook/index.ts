/**
 * sendcloud-webhook
 *
 * Reçoit les webhooks Sendcloud `parcel_status_changed`. Quand un colis est
 * remis au transporteur, retrouve la commande WooCommerce (order_number, sinon
 * external_order_id = wc_order_id) et passe en "processed" les lignes
 * "to_ship" (jeux expédiés par SuperTilt) couvertes par le colis, avec le
 * numéro et le lien de suivi.
 *
 * Garde : signature HMAC `Sendcloud-Signature` (secret SENDCLOUD_SECRET_KEY).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createErrorResponse, createJsonResponse } from "../_shared/cors.ts";
import { timingSafeEqualSecret } from "../_shared/crypto.ts";
import {
  isShippedStatus,
  selectShippedLines,
  sendcloudSignature,
  type SendcloudWebhookEvent,
} from "../_shared/sendcloud.ts";

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
    if (!isShippedStatus(parcel.status?.id)) {
      return createJsonResponse({ skipped: true, reason: `status ${parcel.status?.id}` });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let order: { id: string } | null = null;
    if (parcel.order_number) {
      const { data } = await admin
        .from("woocommerce_orders")
        .select("id")
        .eq("order_number", String(parcel.order_number))
        .maybeSingle();
      order = data;
    }
    const externalId = Number(parcel.external_order_id);
    if (!order && Number.isInteger(externalId) && externalId > 0) {
      const { data } = await admin
        .from("woocommerce_orders")
        .select("id")
        .eq("wc_order_id", externalId)
        .maybeSingle();
      order = data;
    }
    if (!order) {
      return createJsonResponse({ matched: false, reason: "order not found", order_number: parcel.order_number ?? null });
    }

    const { data: candidates, error: candErr } = await admin
      .from("order_items")
      .select("id, wc_product_id, shipped_confirmed_at")
      .eq("woocommerce_order_id", order.id)
      .eq("kanban_status", "to_ship")
      .is("archived_at", null);
    if (candErr) throw candErr;

    const lines = selectShippedLines(candidates ?? [], parcel.parcel_items);
    const now = new Date().toISOString();
    for (const line of lines) {
      const { error } = await admin
        .from("order_items")
        .update({
          kanban_status: "processed",
          shipped_confirmed_at: line.shipped_confirmed_at ?? now,
          sendcloud_parcel_id: parcel.id,
          tracking_number: parcel.tracking_number ?? null,
          tracking_url: parcel.tracking_url ?? null,
        })
        .eq("id", line.id);
      if (error) throw error;
    }

    return createJsonResponse({ matched: true, order_id: order.id, lines_updated: lines.length });
  } catch (err) {
    return createErrorResponse(err instanceof Error ? err.message : String(err), 500, { cause: err, fn: FN });
  }
});
