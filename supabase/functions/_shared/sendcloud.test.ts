import { describe, expect, it } from "vitest";
import { isShippedStatus, safeTrackingUrl, selectShippedLines, sendcloudSignature } from "./sendcloud.ts";

describe("sendcloudSignature", () => {
  it("calcule le HMAC-SHA256 hex du corps brut", async () => {
    // Valeur de référence : printf '%s' '{"action":"parcel_status_changed"}' | openssl dgst -sha256 -hmac secret
    expect(await sendcloudSignature('{"action":"parcel_status_changed"}', "secret")).toBe(
      "e6998b13ba3a2e1cd992ff49851e81d0a82086fb2ca2b4e5c07c3518063e0426",
    );
  });
});

describe("isShippedStatus", () => {
  // Libellés relevés via GET /parcel-statuses du compte SuperTilt le 2026-10-09
  it("retient les statuts transporteur, livré et les statuts inconnus du code", () => {
    expect(isShippedStatus({ id: 3, message: "En route to sorting center" })).toBe(true);
    expect(isShippedStatus({ id: 11, message: "Delivered" })).toBe(true);
    expect(isShippedStatus({ message: "At sorting centre" })).toBe(true);
    expect(isShippedStatus({ message: "Exception" })).toBe(true);
  });

  it("ignore annonce, pré-annonce, annulation et statut inconnu de Sendcloud", () => {
    expect(isShippedStatus({ id: 1, message: "Announced" })).toBe(false);
    expect(isShippedStatus({ message: "Announced" })).toBe(false);
    expect(isShippedStatus({ id: 1000, message: "Ready to send" })).toBe(false);
    expect(isShippedStatus({ id: 2000, message: "Cancelled" })).toBe(false);
    expect(isShippedStatus({ id: 1337 })).toBe(false);
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
