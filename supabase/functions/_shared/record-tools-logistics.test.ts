import { describe, expect, it } from "vitest";
import { parseLogisticsSchedule, setLogisticsItem } from "./record-tools.ts";

const ID = "11111111-1111-1111-1111-111111111111";

function fakeDb(row: Record<string, unknown>) {
  const updates: Record<string, unknown>[] = [];
  const chain: any = {
    select: () => chain, eq: () => chain, order: () => chain,
    ilike: () => Promise.resolve({ data: [row], error: null }),
    update: (p: Record<string, unknown>) => { updates.push(p); return { eq: () => Promise.resolve({ error: null }) }; },
  };
  return { db: { from: () => chain } as any, updates };
}
const noLog = async () => {};

describe("set_logistics_item : échéance", () => {
  it("décale l'échéance sans cocher le point", async () => {
    const { db, updates } = fakeDb({ id: "x", label: "Confirmer le lieu de la formation", is_done: false, due_date: "2026-11-10", notify_days_before: 7 });
    const res = JSON.parse(await setLogisticsItem(db, { entity_type: "training", entity_id: ID, item: "Confirmer le lieu", due_date: "2026-12-01" }, noLog));
    expect(updates[0]).toEqual({ due_date: "2026-12-01" });
    expect(res.after).toEqual({ is_done: false, due_date: "2026-12-01", notify_days_before: 7 });
  });

  it("met un délai d'alerte de 0 jour si le point n'en avait pas", async () => {
    const { db, updates } = fakeDb({ id: "x", label: "Confirmer le lieu", is_done: false, due_date: null, notify_days_before: null });
    await setLogisticsItem(db, { entity_type: "training", entity_id: ID, item: "lieu", due_date: "2026-12-01" }, noLog);
    expect(updates[0]).toEqual({ due_date: "2026-12-01", notify_days_before: 0 });
  });

  it("efface l'échéance avec null", async () => {
    const { db, updates } = fakeDb({ id: "x", label: "Confirmer le lieu", is_done: false, due_date: "2026-11-10", notify_days_before: 7 });
    await setLogisticsItem(db, { entity_type: "training", entity_id: ID, item: "lieu", due_date: null }, noLog);
    expect(updates[0]).toEqual({ due_date: null });
  });

  it("coche toujours sans paramètre d'échéance", async () => {
    const { db, updates } = fakeDb({ id: "x", label: "Confirmer le lieu", is_done: false, due_date: null, notify_days_before: null });
    await setLogisticsItem(db, { entity_type: "training", entity_id: ID, item: "lieu" }, noLog);
    expect(updates[0].is_done).toBe(true);
  });

  it("refuse les dates et délais invalides", () => {
    expect(() => parseLogisticsSchedule({ due_date: "2026-02-30" })).toThrow();
    expect(() => parseLogisticsSchedule({ due_date: "01/12/2026" })).toThrow();
    expect(() => parseLogisticsSchedule({ notify_days_before: -1 })).toThrow();
    expect(() => parseLogisticsSchedule({ notify_days_before: 2.5 })).toThrow();
  });
});
