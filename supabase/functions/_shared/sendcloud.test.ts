import { describe, expect, it } from "vitest";
import { isShippedStatus, selectShippedLines, sendcloudSignature } from "./sendcloud.ts";

describe("sendcloudSignature", () => {
  it("calcule le HMAC-SHA256 hex du corps brut", async () => {
    // Valeur de référence : printf '%s' '{"action":"parcel_status_changed"}' | openssl dgst -sha256 -hmac secret
    expect(await sendcloudSignature('{"action":"parcel_status_changed"}', "secret")).toBe(
      "e6998b13ba3a2e1cd992ff49851e81d0a82086fb2ca2b4e5c07c3518063e0426",
    );
  });
});

describe("isShippedStatus", () => {
  it("retient les statuts transporteur et livré", () => {
    expect(isShippedStatus(3)).toBe(true);
    expect(isShippedStatus(11)).toBe(true);
    expect(isShippedStatus(91)).toBe(true);
  });

  it("ignore annonce, pré-annonce et annulation", () => {
    expect(isShippedStatus(1)).toBe(false);
    expect(isShippedStatus(1000)).toBe(false);
    expect(isShippedStatus(2000)).toBe(false);
    expect(isShippedStatus(undefined)).toBe(false);
  });
});

describe("selectShippedLines", () => {
  const lines = [
    { id: "a", wc_product_id: 101 },
    { id: "b", wc_product_id: 202 },
  ];

  it("filtre sur les product_id du colis", () => {
    expect(selectShippedLines(lines, [{ product_id: "202", quantity: 1 }])).toEqual([lines[1]]);
  });

  it("retient toutes les lignes si le colis ne détaille pas ses articles", () => {
    expect(selectShippedLines(lines, [])).toEqual(lines);
    expect(selectShippedLines(lines, null)).toEqual(lines);
    expect(selectShippedLines(lines, [{ sku: "X", product_id: "" }])).toEqual(lines);
  });
});
