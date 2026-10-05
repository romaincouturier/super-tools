/**
 * Protocole Sendcloud (webhooks).
 *
 * Schéma relevé sur le client PHP maintenu Webador/sendcloud (src/Utility.php,
 * src/Model/Parcel.php, src/Model/ParcelItem.php) : la doc officielle
 * (sendcloud.dev) n'était pas joignable et aucun webhook réel du compte n'a
 * encore été reçu. A confirmer sur le premier envoi réel (règle [061]).
 * - Signature : header `Sendcloud-Signature` = HMAC-SHA256 hex du corps brut,
 *   clé = Secret Key de l'intégration.
 * - Payload : { action: "parcel_status_changed", timestamp, parcel: { id,
 *   status: { id, message }, tracking_number, tracking_url, order_number,
 *   external_order_id, parcel_items: [{ product_id, sku, quantity, ... }] } }
 */

export interface SendcloudParcelItem {
  product_id?: string | number | null;
  sku?: string | null;
  quantity?: number | null;
  description?: string | null;
}

export interface SendcloudParcel {
  id: number;
  status?: { id: number; message?: string };
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

// Statuts où le colis est entre les mains du transporteur (ou déjà livré).
// Exclus : 1 annoncé (étiquette créée, pas encore remis), 13 annoncé non
// collecté, 999-1002 pré-annonce, 1337 inconnu, 1998-2001 annulation.
const SHIPPED_STATUS_IDS = new Set([3, 4, 5, 6, 7, 8, 11, 12, 15, 22, 80, 91, 92, 93]);

export function isShippedStatus(statusId: number | undefined | null): boolean {
  return statusId != null && SHIPPED_STATUS_IDS.has(statusId);
}

/**
 * Lignes SuperTools couvertes par le colis. Si le colis détaille ses articles
 * avec un product_id WooCommerce, seules les lignes de ces produits sont
 * retenues ; sinon toutes les lignes candidates de la commande.
 */
export function selectShippedLines<T extends { wc_product_id: number }>(
  candidates: T[],
  parcelItems: SendcloudParcelItem[] | null | undefined,
): T[] {
  const productIds = new Set(
    (parcelItems ?? [])
      .map((p) => Number(p.product_id))
      .filter((n) => Number.isInteger(n) && n > 0),
  );
  if (productIds.size === 0) return candidates;
  return candidates.filter((c) => productIds.has(c.wc_product_id));
}
