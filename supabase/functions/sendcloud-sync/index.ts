/**
 * sendcloud-sync
 *
 * Cron horaire. Lit dans Sendcloud les expéditions mises à jour depuis le
 * dernier passage réussi et, pour chaque colis remis au transporteur, rattache
 * les lignes de jeux expédiés par SuperTilt (game_type supertilt ou partner)
 * de la commande WooCommerce : passage en "processed", date d'envoi, numéro et
 * lien de suivi. Remplace le webhook, réservé aux formules Sendcloud payantes.
 *
 * Garde : x-cron-secret (SENDCLOUD_CRON_SECRET) ou service_role.
 * API : clés de l'intégration Sendcloud API (SENDCLOUD_API_PUBLIC_KEY,
 * SENDCLOUD_API_SECRET_KEY).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createErrorResponse, createJsonResponse } from "../_shared/cors.ts";
import { isCronOrServiceRole } from "../_shared/cron-auth.ts";
import {
  basicAuthHeader,
  isShippedStatus,
  nextPageUrl,
  type OrderParcel,
  parcelsWithOrder,
  safeTrackingUrl,
  selectShippedLines,
  type SendcloudShipment,
  shipmentsUrl,
  walkShipmentPages,
} from "../_shared/sendcloud.ts";

const FN = "sendcloud-sync";
// Jeux expédiés depuis le stock SuperTilt (les jeux dropshipping partent de chez l'auteur)
const SHIPPED_BY_SUPERTILT = ["supertilt", "partner"];
const LOCKED_STATUSES = "(blocked,to_validate)";
/** Premier passage : rattrape les colis du dernier mois. */
const FIRST_RUN_LOOKBACK_MS = 30 * 24 * 3600 * 1000;
/** Recouvrement entre deux passages, pour ne rien perdre aux bornes. */
const OVERLAP_MS = 10 * 60 * 1000;
const MAX_PAGES = 20;

Deno.serve(async (req: Request): Promise<Response> => {
  if (!(await isCronOrServiceRole(req, "SENDCLOUD_CRON_SECRET"))) {
    return createErrorResponse("Unauthorized", 401);
  }

  const publicKey = Deno.env.get("SENDCLOUD_API_PUBLIC_KEY");
  const secretKey = Deno.env.get("SENDCLOUD_API_SECRET_KEY");
  if (!publicKey || !secretKey) {
    return createErrorResponse("SENDCLOUD_API_PUBLIC_KEY / SENDCLOUD_API_SECRET_KEY non configurés", 500, { fn: FN });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const runStartedAt = new Date();

  const setCursor = (patch: Record<string, unknown>) =>
    admin.from("polling_cursors").update({ last_synced_at: runStartedAt.toISOString(), ...patch }).eq("source", "sendcloud");

  try {
    const { data: cursorRow, error: cursorErr } = await admin
      .from("polling_cursors")
      .select("cursor")
      .eq("source", "sendcloud")
      .maybeSingle();
    if (cursorErr) throw cursorErr;

    const lastSuccess = cursorRow?.cursor ? new Date(cursorRow.cursor).getTime() : NaN;
    const since = Number.isNaN(lastSuccess)
      ? new Date(runStartedAt.getTime() - FIRST_RUN_LOOKBACK_MS)
      : new Date(lastSuccess - OVERLAP_MS);

    const auth = basicAuthHeader(publicKey, secretKey);
    const walk = await walkShipmentPages(async (url) => {
      const res = await fetch(url, { headers: { Authorization: auth, Accept: "application/json" } });
      if (!res.ok) return { status: res.status, shipments: [], next: null };
      const body = (await res.json()) as { data?: SendcloudShipment[] };
      return { status: res.status, shipments: body.data ?? [], next: nextPageUrl(res.headers.get("link")) };
    }, shipmentsUrl(since.toISOString()), MAX_PAGES);
    if (walk.error) throw new Error(walk.error);

    const parcels = parcelsWithOrder(walk.shipments).filter((p) => isShippedStatus(p.status));
    const results = { shipments: walk.shipments.length, parcels_shipped: parcels.length, orders_not_found: 0, lines_updated: 0 };

    for (const parcel of parcels) {
      results.lines_updated += await applyParcel(admin, parcel, results);
    }

    // Plafond de pages atteint : le curseur n'avance pas, le prochain passage
    // reprend la même fenêtre (le rapprochement est idempotent).
    await setCursor(walk.truncated
      ? { status: "idle", last_error: "Plafond de pages atteint, reprise au prochain passage" }
      : { status: "idle", last_error: null, cursor: runStartedAt.toISOString() });

    return createJsonResponse({ ...results, since: since.toISOString(), pages: walk.pages, truncated: walk.truncated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setCursor({ status: "error", last_error: message });
    return createErrorResponse(message, 500, { cause: err, fn: FN });
  }
});

async function applyParcel(
  admin: ReturnType<typeof createClient>,
  parcel: OrderParcel,
  results: { orders_not_found: number },
): Promise<number> {
  const { data: orders, error: orderErr } = await admin
    .from("woocommerce_orders")
    .select("id")
    .eq("order_number", parcel.order_number)
    .limit(2);
  if (orderErr) throw orderErr;
  if ((orders ?? []).length > 1) throw new Error(`Plusieurs commandes WooCommerce avec le numéro ${parcel.order_number}`);
  const order = orders?.[0];
  if (!order) {
    results.orders_not_found++;
    return 0;
  }

  const { data: rows, error: candErr } = await admin
    .from("order_items")
    .select("id, wc_product_id, sendcloud_parcel_id, raw_line_item")
    .eq("woocommerce_order_id", order.id)
    .in("game_type", SHIPPED_BY_SUPERTILT)
    .not("kanban_status", "in", LOCKED_STATUSES)
    .is("archived_at", null);
  if (candErr) throw candErr;

  const candidates = ((rows ?? []) as Array<{ id: string; wc_product_id: number; sendcloud_parcel_id: number | null; raw_line_item: { id?: unknown } | null }>)
    .map((r) => {
      const lineId = Number(r.raw_line_item?.id);
      return { ...r, wc_line_item_id: Number.isInteger(lineId) ? lineId : null };
    });
  const ids = selectShippedLines(candidates, parcel).map((l) => l.id);
  if (ids.length === 0) return 0;

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

  return ids.length;
}
