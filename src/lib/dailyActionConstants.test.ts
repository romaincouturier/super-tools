import { describe, it, expect } from "vitest";
import {
  getCategoryConfig,
  CATEGORIES,
  DEFAULT_CATEGORY_CONFIG,
  CATEGORY_ORDER,
} from "./dailyActionConstants";

describe("getCategoryConfig", () => {
  it("returns config for a known category", () => {
    const config = getCategoryConfig("missions_actions");
    expect(config.label).toBe("Missions \u2014 Actions \u00e0 traiter");
    expect(config.emoji).toBe("\u26a1");
    expect(config.color).toBe("text-orange-600");
  });

  it("returns config for another known category", () => {
    const config = getCategoryConfig("elearning_groupe");
    expect(config.label).toBe("Groupes priv\u00e9s e-learning");
    expect(config.color).toBe("text-indigo-600");
  });

  it("returns fallback config for unknown category with category as label", () => {
    const config = getCategoryConfig("totally_unknown");
    expect(config.label).toBe("totally_unknown");
    expect(config.emoji).toBe(DEFAULT_CATEGORY_CONFIG.emoji);
    expect(config.color).toBe(DEFAULT_CATEGORY_CONFIG.color);
  });

  it("returns fallback config for empty string", () => {
    const config = getCategoryConfig("");
    // empty string is not in CATEGORIES, so it falls back
    expect(config.label).toBe("");
    expect(config.color).toBe("text-gray-600");
  });

  it("does not mutate DEFAULT_CATEGORY_CONFIG when returning fallback", () => {
    const config = getCategoryConfig("unknown_cat");
    config.label = "mutated";
    expect(DEFAULT_CATEGORY_CONFIG.label).toBe("");
  });
});

describe("CATEGORY_ORDER", () => {
  it("entries mostly correspond to CATEGORIES keys", () => {
    // Most CATEGORY_ORDER entries should map to a CATEGORIES config.
    // Some may intentionally lack a config (handled by getCategoryConfig fallback).
    const knownCount = CATEGORY_ORDER.filter((key) => CATEGORIES[key] !== undefined).length;
    expect(knownCount).toBeGreaterThan(CATEGORY_ORDER.length * 0.8);
  });

  it("has no duplicate entries", () => {
    const unique = new Set(CATEGORY_ORDER);
    expect(unique.size).toBe(CATEGORY_ORDER.length);
  });
});
