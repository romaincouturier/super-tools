/**
 * Protocole Sendcloud (webhooks).
 *
 * Schéma relevé le 2026-10-09 sur le compte SuperTilt (connecteur Sendcloud,
 * GET /shipments, intégration woocommerce_v2 #597848) :
 * - colis 725451859 : order_number "125140" = woocommerce_orders.order_number,
 *   parcel_items[0].item_id "8280" = order_items.raw_line_item.id,
 *   parcel_items[0].product_id "78179" = order_items.wc_product_id.
 * - colis créés à la main (722061321, 719799661) : order_number "" et
 *   parcel_items [] -> non rapprochables, ignorés.
 * Signature (client Webador/sendcloud, src/Utility.php) : header
 * `Sendcloud-Signature` = HMAC-SHA256 hex du corps brut.
 */

export interface SendcloudParcelItem {
  item_id?: string | number | null;
  product_id?: string | number | null;
  sku?: string | null;
  quantity?: number | null;
  description?: string | null;
}

export interface SendcloudParcel {
  id: number;
  status?: { id?: number; message?: string; code?: string };
  tracking_number?: string | null;
  tracking_url?: string | null;
  order_number?: string | null;
  external_order_id?: string | null;
  parcel_items?: SendcloudParcelItem[] | null;
}

export interface SendcloudWebhookEvent {
  action: string;
  timestamp?: number;
  parcel?: SendcloudParcel;
}

export async function sendcloudSignature(rawBody: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Statuts où le colis n'est pas encore (ou plus) entre les mains du
// transporteur. Libellés relevés via GET /parcel-statuses du compte ; ids
// numériques du payload v2 relevés sur Webador/sendcloud (Parcel.php).
// Tout autre statut, y compris un statut ajouté plus tard par Sendcloud,
// vaut remise au transporteur : on ne rejette pas une valeur jamais vue.
const NOT_SHIPPED_STATUS_IDS = new Set([1, 13, 15, 999, 1000, 1001, 1002, 1337, 1998, 1999, 2000, 2001]);
const NOT_SHIPPED_STATUS_MESSAGES = new Set([
  "Ready to send",
  "Announced",
  "Announced: not collected",
  "Error collecting",
  "No label",
  "Being announced",
  "Announcement failed",
  "Submitting cancellation request",
  "Cancellation requested",
  "Cancelled",
  "Cancelled upstream",
  "Parcel cancellation failed.",
  "Unknown status - check carrier track & trace page for more insights",
  "Address invalid",
]);

export function isShippedStatus(status: SendcloudParcel["status"]): boolean {
  if (!status || (status.id == null && !status.message)) return false;
  if (status.id != null && NOT_SHIPPED_STATUS_IDS.has(status.id)) return false;
  if (status.message && NOT_SHIPPED_STATUS_MESSAGES.has(status.message)) return false;
  return true;
}

export function safeTrackingUrl(url: string | null | undefined): string | null {
  return url && url.startsWith("https://") ? url : null;
}

/**
 * Lignes SuperTools couvertes par le colis, par ordre de précision :
 * item_id (ligne WooCommerce), puis product_id, puis, si le colis ne détaille
 * pas ses articles, les lignes de la commande pas encore rattachées à un autre
 * colis (chaque changement de statut renvoie le webhook pour le même colis).
 */
export function selectShippedLines<
  T extends { wc_product_id: number; wc_line_item_id: number | null; sendcloud_parcel_id: number | null },
>(candidates: T[], parcel: Pick<SendcloudParcel, "id" | "parcel_items">): T[] {
  const parcelItems = parcel.parcel_items;
  const ids = (key: "item_id" | "product_id") =>
    new Set(
      (parcelItems ?? [])
        .map((p) => Number(p[key]))
        .filter((n) => Number.isInteger(n) && n > 0),
    );
  const itemIds = ids("item_id");
  if (itemIds.size > 0) return candidates.filter((c) => c.wc_line_item_id != null && itemIds.has(c.wc_line_item_id));
  const productIds = ids("product_id");
  if (productIds.size > 0) return candidates.filter((c) => productIds.has(c.wc_product_id));
  return candidates.filter((c) => c.sendcloud_parcel_id == null || c.sendcloud_parcel_id === parcel.id);
}
