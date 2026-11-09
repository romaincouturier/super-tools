import { describe, it, expect } from "vitest";
import { computePostAlerts, formatAlert, socialTextLength } from "./social-post-alerts";

const instagram = { text_limit: 2200 };
const blog = { text_limit: null };
const VISUAL = "media-1";

describe("computePostAlerts", () => {
  it("signale un visuel manquant, quel que soit le canal", () => {
    expect(computePostAlerts({ text: "Court", media_id: null }, instagram)).toEqual([{ kind: "missing_visual" }]);
    expect(computePostAlerts({ text: "Court", media_id: null }, blog)).toEqual([{ kind: "missing_visual" }]);
    expect(computePostAlerts({ text: "Court", media_id: null }, undefined)).toEqual([{ kind: "missing_visual" }]);
  });

  it("signale un texte trop long avec la limite et le dépassement", () => {
    const alerts = computePostAlerts({ text: "a".repeat(2250), media_id: VISUAL }, instagram);
    expect(alerts).toEqual([{ kind: "text_too_long", length: 2250, limit: 2200, excess: 50 }]);
    expect(formatAlert(alerts[0])).toBe("Texte trop long : 2 250 / 2 200 (+50)");
  });

  it("ne signale jamais de longueur pour un canal sans limite", () => {
    expect(computePostAlerts({ text: "a".repeat(10_000), media_id: VISUAL }, blog)).toEqual([]);
  });

  it("compte les emojis en points de code", () => {
    const text = "😀".repeat(200) + "a".repeat(2000);
    expect(text.length).toBe(2400);
    expect(socialTextLength(text)).toBe(2200);
    expect(computePostAlerts({ text, media_id: VISUAL }, instagram)).toEqual([]);
    expect(computePostAlerts({ text: text + "😀", media_id: VISUAL }, instagram)).toEqual([
      { kind: "text_too_long", length: 2201, limit: 2200, excess: 1 },
    ]);
  });

  it("n'alerte pas à la limite exacte et cumule les deux alertes", () => {
    expect(computePostAlerts({ text: "a".repeat(2200), media_id: VISUAL }, instagram)).toEqual([]);
    expect(computePostAlerts({ text: "a".repeat(2201), media_id: null }, instagram).map((a) => a.kind)).toEqual([
      "missing_visual", "text_too_long",
    ]);
  });

  it("traite un texte null comme vide", () => {
    expect(computePostAlerts({ text: null, media_id: VISUAL }, instagram)).toEqual([]);
  });
});

describe("formatAlert", () => {
  it("rédige l'alerte de visuel manquant", () => {
    expect(formatAlert({ kind: "missing_visual" })).toBe("Visuel manquant");
  });

  it("groupe les milliers du dépassement", () => {
    expect(formatAlert({ kind: "text_too_long", length: 64206, limit: 63206, excess: 1000 }))
      .toBe("Texte trop long : 64 206 / 63 206 (+1 000)");
  });
});
