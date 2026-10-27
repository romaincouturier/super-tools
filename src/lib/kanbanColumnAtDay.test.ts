import { describe, it, expect } from "vitest";
import { columnAtDay } from "./kanbanColumnAtDay";

const d = (s: string) => new Date(`${s}T23:59:59`);
const item = {
  id: "c", columnId: "WON", createdAt: "2026-09-01T10:00:00", completedAt: "2026-10-20T10:00:00",
  moves: [
    { at: "2026-09-10T10:00:00", from: "prospect", to: "devis" },
    { at: "2026-10-05T10:00:00", from: "devis", to: "nego" },
  ],
};

describe("columnAtDay", () => {
  it("uses the column before the first move", () => expect(columnAtDay(item, d("2026-09-05"), "first")).toBe("prospect"));
  it("replays moves", () => {
    expect(columnAtDay(item, d("2026-09-20"), "first")).toBe("devis");
    expect(columnAtDay(item, d("2026-10-10"), "first")).toBe("nego");
  });
  it("enters done column on closure date", () => expect(columnAtDay(item, d("2026-10-20"), "first")).toBe("WON"));
  it("is absent before creation", () => expect(columnAtDay(item, d("2026-08-31"), "first")).toBeNull());
  it("falls back to entry column for closed items without history", () =>
    expect(columnAtDay({ ...item, moves: [] }, d("2026-09-20"), "first")).toBe("first"));
  it("keeps open items without history in their current column", () =>
    expect(columnAtDay({ ...item, completedAt: null, columnId: "nego", moves: [] }, d("2026-09-20"), "first")).toBe("nego"));
});
