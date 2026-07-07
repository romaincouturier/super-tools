import { describe, it, expect } from "vitest";
import { computeMeanCycleTime, cardAgeDays } from "./kanban-metrics";
import type { KanbanStatsItem } from "@/types/kanban";

function item(overrides: Partial<KanbanStatsItem>): KanbanStatsItem {
  return {
    id: "i1",
    columnId: "done",
    createdAt: "2026-06-01T10:00:00Z",
    completedAt: null,
    value: null,
    ...overrides,
  };
}

describe("computeMeanCycleTime", () => {
  it("retourne 0 sans élément terminé", () => {
    expect(computeMeanCycleTime([], ["done"])).toBe(0);
    expect(computeMeanCycleTime([item({ columnId: "todo" })], ["done"])).toBe(0);
    // Dans une colonne done mais sans completedAt → ignoré
    expect(computeMeanCycleTime([item({ completedAt: null })], ["done"])).toBe(0);
  });

  it("calcule la moyenne des temps de cycle en jours calendaires", () => {
    const items = [
      item({ id: "a", createdAt: "2026-06-01T10:00:00Z", completedAt: "2026-06-05T09:00:00Z" }), // 4 j
      item({ id: "b", createdAt: "2026-06-01T10:00:00Z", completedAt: "2026-06-11T18:00:00Z" }), // 10 j
    ];
    expect(computeMeanCycleTime(items, ["done"])).toBe(7);
  });

  it("borne à 0 un temps de cycle négatif (completedAt avant createdAt)", () => {
    const items = [
      item({ createdAt: "2026-06-10T10:00:00Z", completedAt: "2026-06-05T10:00:00Z" }),
    ];
    expect(computeMeanCycleTime(items, ["done"])).toBe(0);
  });

  it("ne compte que les colonnes déclarées done", () => {
    const items = [
      item({ id: "a", columnId: "done", completedAt: "2026-06-03T10:00:00Z" }), // 2 j
      item({ id: "b", columnId: "in_progress", completedAt: "2026-06-30T10:00:00Z" }),
    ];
    expect(computeMeanCycleTime(items, ["done"])).toBe(2);
  });
});

describe("cardAgeDays", () => {
  it("retourne un âge positif pour une date passée", () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString();
    expect(cardAgeDays(tenDaysAgo)).toBe(10);
  });

  it("borne à 0 une date future", () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    expect(cardAgeDays(tomorrow)).toBe(0);
  });
});
