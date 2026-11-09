import { describe, expect, it } from "vitest";
import {
  basicAuthHeader,
  isShippedStatus,
  nextPageUrl,
  parcelsWithOrder,
  safeTrackingUrl,
  selectShippedLines,
  shipmentsUrl,
  walkShipmentPages,
  type ShipmentsPage,
} from "./sendcloud.ts";

describe("requête", () => {
  it("authentifie en Basic clé publique:clé secrète", () => {
    expect(basicAuthHeader("pub", "sec")).toBe(`Basic ${btoa("pub:sec")}`);
  });

  it("filtre les expéditions par date de mise à jour", () => {
    expect(shipmentsUrl("2026-11-01T00:00:00.000Z", 50)).toBe(
      "https://panel.sendcloud.sc/api/v3/shipments?updated_after=2026-11-01T00%3A00%3A00.000Z&page_size=50",
    );
  });
});

describe("nextPageUrl", () => {
  it("lit la page suivante dans l'en-tête Link", () => {
    expect(
      nextPageUrl('<https://panel.sendcloud.sc/api/v3/shipments?cursor=cD0x>; rel="next", <https://x/prev>; rel="prev"'),
    ).toBe("https://panel.sendcloud.sc/api/v3/shipments?cursor=cD0x");
  });

  it("renvoie null sans page suivante", () => {
    expect(nextPageUrl('<https://x/prev>; rel="prev"')).toBeNull();
    expect(nextPageUrl(null)).toBeNull();
  });
});

describe("walkShipmentPages", () => {
  const page = (ids: string[], next: string | null, status = 200): ShipmentsPage => ({
    status,
    shipments: ids.map((id) => ({ id })),
    next,
  });

  it("enchaîne les pages jusqu'à la dernière", async () => {
    const pages: Record<string, ShipmentsPage> = { a: page(["1", "2"], "b"), b: page(["3"], null) };
    const walk = await walkShipmentPages(async (url) => pages[url], "a", 10);
    expect(walk).toEqual({ shipments: [{ id: "1" }, { id: "2" }, { id: "3" }], pages: 2, truncated: false, error: null });
  });

  it("remonte une page en échec comme une erreur", async () => {
    const pages: Record<string, ShipmentsPage> = { a: page(["1"], "b"), b: page([], null, 500) };
    const walk = await walkShipmentPages(async (url) => pages[url], "a", 10);
    expect(walk.error).toBe("page 2 : Sendcloud a répondu 500");
    expect(walk.truncated).toBe(true);
  });

  it("s'arrête au plafond de pages", async () => {
    const walk = await walkShipmentPages(async () => page(["1"], "encore"), "a", 2);
    expect(walk).toMatchObject({ pages: 2, truncated: true, error: null });
  });
});

describe("parcelsWithOrder", () => {
  // Expéditions relevées sur le compte : 125140 importée de WooCommerce,
  // 722061321 créée à la main (order_number vide).
  it("rattache chaque colis au numéro de commande et ignore les envois manuels", () => {
    expect(
      parcelsWithOrder([
        { id: "s1", order_number: "125140", parcels: [{ id: 725451859 }] },
        { id: "s2", order_number: "", parcels: [{ id: 722061321 }] },
        { id: "s3", order_number: null, parcels: null },
      ]),
    ).toEqual([{ id: 725451859, order_number: "125140" }]);
  });

  it("ignore une expédition sans colis", () => {
    expect(parcelsWithOrder([{ id: "s4", order_number: "125141", parcels: null }])).toEqual([]);
  });
});

describe("isShippedStatus", () => {
  // Codes relevés via GET /parcel-statuses du compte SuperTilt le 2026-10-09
  it("retient les statuts transporteur, livré et les statuts inconnus du code", () => {
    expect(isShippedStatus({ code: "TO_SORTING" })).toBe(true);
    expect(isShippedStatus({ code: "DELIVERED" })).toBe(true);
    expect(isShippedStatus({ code: "EXCEPTION" })).toBe(true);
    expect(isShippedStatus({ code: "UN_STATUT_FUTUR" })).toBe(true);
  });

  it("ignore annonce, pré-annonce, annulation et statut inconnu de Sendcloud", () => {
    expect(isShippedStatus({ code: "ANNOUNCED", message: "Announced" })).toBe(false);
    expect(isShippedStatus({ code: "READY_TO_SEND" })).toBe(false);
    expect(isShippedStatus({ code: "CANCELLED" })).toBe(false);
    expect(isShippedStatus({ code: "UNKNOWN" })).toBe(false);
    expect(isShippedStatus(undefined)).toBe(false);
    expect(isShippedStatus({})).toBe(false);
  });
});

describe("safeTrackingUrl", () => {
  it("n'accepte que https", () => {
    expect(safeTrackingUrl("https://tracking.eu-central-1-0.sendcloud.sc/forward?code=6A07960471086")).toBe(
      "https://tracking.eu-central-1-0.sendcloud.sc/forward?code=6A07960471086",
    );
    expect(safeTrackingUrl("javascript:alert(1)")).toBeNull();
    expect(safeTrackingUrl(null)).toBeNull();
  });
});

describe("selectShippedLines", () => {
  // Commande 124951 : colis 722059363 avec item_id "8257", product_id "78179"
  const lines = [
    { id: "a", wc_product_id: 78179, wc_line_item_id: 8257, sendcloud_parcel_id: null },
    { id: "b", wc_product_id: 95225, wc_line_item_id: 8258, sendcloud_parcel_id: null },
    { id: "c", wc_product_id: 78179, wc_line_item_id: 8300, sendcloud_parcel_id: 111 },
  ];

  it("rapproche par item_id (ligne WooCommerce) en priorité", () => {
    expect(selectShippedLines(lines, { id: 1, parcel_items: [{ item_id: "8257", product_id: "78179" }] })).toEqual([lines[0]]);
  });

  it("se rabat sur product_id sans item_id", () => {
    expect(selectShippedLines(lines, { id: 1, parcel_items: [{ product_id: "95225" }] })).toEqual([lines[1]]);
  });

  it("sans détail d'articles, ne prend que les lignes libres ou déjà rattachées à ce colis", () => {
    expect(selectShippedLines(lines, { id: 1, parcel_items: [] })).toEqual([lines[0], lines[1]]);
    expect(selectShippedLines(lines, { id: 1, parcel_items: null })).toEqual([lines[0], lines[1]]);
    expect(selectShippedLines(lines, { id: 111, parcel_items: [] })).toEqual(lines);
  });
});
