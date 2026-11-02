/**
 * Protocole Sendcloud (API v3, synchronisation programmée).
 *
 * Schéma relevé le 2026-10-09 sur le compte SuperTilt (connecteur Sendcloud,
 * GET /shipments, intégration woocommerce_v2 #597848) :
 * - expédition : order_number "125140" = woocommerce_orders.order_number ;
 * - colis 725451859 (parcels[0]) : status { code: "ANNOUNCED", message:
 *   "Announced" }, tracking_number, tracking_url ;
 *   parcel_items[0].item_id "8280" = order_items.raw_line_item.id,
 *   parcel_items[0].product_id "78179" = order_items.wc_product_id ;
 * - expéditions créées à la main (722061321, 719799661) : order_number "" et
 *   parcel_items [] -> non rapprochables, ignorées.
 * - liens de documents servis sous https://panel.sendcloud.sc/api/v3/.
 * Non relevé sur le compte : l'en-tête Link de pagination (format standard
 * `<url>; rel="next"` décrit par la doc du endpoint). Une page en échec
 * remonte en erreur, jamais en succès partiel.
 */

export const SENDCLOUD_API_BASE = "https://panel.sendcloud.sc/api/v3";

export interface SendcloudParcelItem {
  item_id?: string | number | null;
  product_id?: string | number | null;
  sku?: string | null;
  quantity?: number | null;
  description?: string | null;
}

export interface SendcloudParcel {
  id: number;
  status?: { code?: string; message?: string };
  tracking_number?: string | null;
  tracking_url?: string | null;
  parcel_items?: SendcloudParcelItem[] | null;
}

export interface SendcloudShipment {
  id: string;
  order_number?: string | null;
  parcels?: SendcloudParcel[] | null;
}

/** Colis rattaché au numéro de commande porté par son expédition. */
export interface OrderParcel extends SendcloudParcel {
  order_number: string;
}

export function basicAuthHeader(publicKey: string, secretKey: string): string {
  return `Basic ${btoa(`${publicKey}:${secretKey}`)}`;
}

export function shipmentsUrl(updatedAfter: string, pageSize = 100): string {
  const params = new URLSearchParams({ updated_after: updatedAfter, page_size: String(pageSize) });
  return `${SENDCLOUD_API_BASE}/shipments?${params}`;
}

/** URL de la page suivante lue dans l'en-tête Link, ou null. */
export function nextPageUrl(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(",")) {
    const m = part.match(/<([^>]+)>\s*;\s*rel="?next"?/);
    if (m) return m[1];
  }
  return null;
}

export interface ShipmentsPage {
  status: number;
  shipments: SendcloudShipment[];
  next: string | null;
}

export interface ShipmentsWalk {
  shipments: SendcloudShipment[];
  pages: number;
  truncated: boolean;
  error: string | null;
}

/** Parcourt les pages de GET /shipments. Une page en échec est une erreur. */
export async function walkShipmentPages(
  fetchPage: (url: string) => Promise<ShipmentsPage>,
  firstUrl: string,
  maxPages: number,
): Promise<ShipmentsWalk> {
  const shipments: SendcloudShipment[] = [];
  let url: string | null = firstUrl;
  let pages = 0;
  while (url) {
    if (pages >= maxPages) return { shipments, pages, truncated: true, error: null };
    const page = await fetchPage(url);
    if (page.status < 200 || page.status >= 300) {
      return { shipments, pages, truncated: true, error: `page ${pages + 1} : Sendcloud a répondu ${page.status}` };
    }
    shipments.push(...page.shipments);
    pages++;
    url = page.next;
  }
  return { shipments, pages, truncated: false, error: null };
}

/** Colis des expéditions qui portent un numéro de commande. */
export function parcelsWithOrder(shipments: SendcloudShipment[]): OrderParcel[] {
  return shipments.flatMap((s) => {
    const orderNumber = (s.order_number ?? "").trim();
    if (!orderNumber) return [];
    return (s.parcels ?? []).map((p) => ({ ...p, order_number: orderNumber }));
  });
}

// Statuts où le colis n'est pas encore (ou plus) entre les mains du
// transporteur, relevés via GET /parcel-statuses du compte (code et libellé).
// Tout autre statut, y compris un statut ajouté plus tard par Sendcloud, vaut
// remise au transporteur : on ne rejette pas une valeur jamais vue.
const NOT_SHIPPED_STATUS_CODES = new Set([
  "READY_TO_SEND",
  "ANNOUNCED",
  "ANNOUNCED_UNCOLLECTED",
  "COLLECT_ERROR",
  "NO_LABEL",
  "ANNOUNCING",
  "ANNOUNCEMENT_FAILED",
  "CANCELLING_UPSTREAM",
  "CANCELLING",
  "CANCELLED",
  "CANCELLED_UPSTREAM",
  "CANCELLATION_FAILED",
  "UNKNOWN",
  "ADDRESS_INVALID",
]);

export function isShippedStatus(status: SendcloudParcel["status"]): boolean {
  if (!status?.code) return false;
  return !NOT_SHIPPED_STATUS_CODES.has(status.code);
}

export function safeTrackingUrl(url: string | null | undefined): string | null {
  return url && url.startsWith("https://") ? url : null;
}

/**
 * Lignes SuperTools couvertes par le colis, par ordre de précision :
 * item_id (ligne WooCommerce), puis product_id, puis, si le colis ne détaille
 * pas ses articles, les lignes de la commande pas encore rattachées à un autre
 * colis (un même colis revient à chaque changement de statut).
 */
export function selectShippedLines<
  T extends { wc_product_id: number; wc_line_item_id: number | null; sendcloud_parcel_id: number | null },
>(candidates: T[], parcel: Pick<SendcloudParcel, "id" | "parcel_items">): T[] {
  const ids = (key: "item_id" | "product_id") =>
    new Set(
      (parcel.parcel_items ?? [])
        .map((p) => Number(p[key]))
        .filter((n) => Number.isInteger(n) && n > 0),
    );
  const itemIds = ids("item_id");
  if (itemIds.size > 0) return candidates.filter((c) => c.wc_line_item_id != null && itemIds.has(c.wc_line_item_id));
  const productIds = ids("product_id");
  if (productIds.size > 0) return candidates.filter((c) => productIds.has(c.wc_product_id));
  return candidates.filter((c) => c.sendcloud_parcel_id == null || c.sendcloud_parcel_id === parcel.id);
}
