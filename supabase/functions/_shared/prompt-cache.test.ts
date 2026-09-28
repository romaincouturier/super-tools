import { describe, it, expect } from "vitest";
import { cacheHitRate, isArenaHistoryAppendOnly, joinedParts, textBlocks } from "./prompt-cache.ts";

const entries = (n: number) => Array.from({ length: n }, (_, i) => `[Expert ${i}]: message ${i}`);

describe("joinedParts / textBlocks", () => {
  it("rend exactement le texte d'origine", () => {
    const header = "Historique :\n\n";
    const parts = joinedParts(header, entries(4), "\n\n");
    const text = textBlocks(parts, true).map((b) => b.text).join("");
    expect(text).toBe(header + entries(4).join("\n\n"));
  });

  it("garde le préfixe d'un appel identique octet pour octet à l'appel suivant", () => {
    const before = textBlocks(joinedParts("H\n\n", entries(3), "\n\n"), false);
    const after = textBlocks(joinedParts("H\n\n", entries(5), "\n\n"), false);
    expect(after.slice(0, before.length)).toEqual(before);
  });

  it("ne pose le point de cache que sur le dernier bloc", () => {
    const blocks = textBlocks(["a", "b", "c"], true);
    expect(blocks.map((b) => b.cache_control)).toEqual([undefined, undefined, { type: "ephemeral" }]);
    expect(textBlocks(["a", "b"], false).some((b) => b.cache_control)).toBe(false);
  });

  it("écarte les blocs vides, refusés par l'API", () => {
    expect(textBlocks(["", "a", ""], true)).toEqual([
      { type: "text", text: "a", cache_control: { type: "ephemeral" } },
    ]);
    expect(textBlocks([], true)).toEqual([]);
  });
});

describe("isArenaHistoryAppendOnly", () => {
  it("détecte le résumé de fenêtre glissante de buildSlidingContext", () => {
    expect(isArenaHistoryAppendOnly([
      { agentName: "Systeme", content: "[Resume des 5 messages precedents]\n- A: ..." },
      { agentName: "A", content: "x" },
    ])).toBe(false);
    expect(isArenaHistoryAppendOnly([{ agentName: "A", content: "x" }])).toBe(true);
    expect(isArenaHistoryAppendOnly([])).toBe(true);
  });
});

describe("cacheHitRate", () => {
  it("rapporte la lecture au prompt total", () => {
    expect(cacheHitRate({ inputTokens: 100, cacheReadTokens: 800, cacheWriteTokens: 100 })).toBe(0.8);
    expect(cacheHitRate({ inputTokens: 0 })).toBe(0);
  });
});
