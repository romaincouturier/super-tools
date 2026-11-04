import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.hoisted(() => ({ select: vi.fn(), eq: vi.fn(), order: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => query } }));
import { fetchOpenGameDevisContacts, loadGameDevisDefaults, resolveGameDevisPrice, saveGameDevisFees, saveGameDevisPrice } from "./gameDevisDefaults";

function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

describe("Defaults for game quotes", () => {
  it("reloads the latest edited price for the selected game", () => {
    const saved = storage();
    saveGameDevisPrice(saved, "game-a", "", 49);
    saveGameDevisPrice(saved, "game-a", "", 59);
    expect(resolveGameDevisPrice(loadGameDevisDefaults(saved).prices, "game-a", "", 10)).toBe(59);
    expect(resolveGameDevisPrice(loadGameDevisDefaults(saved).prices, "game-b", "", 25)).toBe(25);
  });
  it("keeps rental and sale prices separate", () => {
    const saved = storage();
    saveGameDevisPrice(saved, "game-a", "rental", 30);
    saveGameDevisPrice(saved, "game-a", "sale", 90);
    const { prices } = loadGameDevisDefaults(saved);
    expect(resolveGameDevisPrice(prices, "game-a", "rental", 10)).toBe(30);
    expect(resolveGameDevisPrice(prices, "game-a", "sale", 10)).toBe(90);
  });
  it("reloads shipping fees immediately, without sending a quote", () => {
    const saved = storage();
    saveGameDevisFees(saved, { fraisDePort: 12.5, fraisDossier: 5 });
    saveGameDevisFees(saved, { fraisDePort: 15.75, fraisDossier: 5 });
    expect(loadGameDevisDefaults(saved).fraisDePort).toBe(15.75);
  });
  it("reloads dossier fees immediately, including free fees", () => {
    const saved = storage();
    saveGameDevisFees(saved, { fraisDePort: 10, fraisDossier: 25 });
    expect(loadGameDevisDefaults(saved).fraisDossier).toBe(25);
    saveGameDevisFees(saved, { fraisDePort: 10, fraisDossier: 0 });
    expect(loadGameDevisDefaults(saved).fraisDossier).toBe(0);
  });
  it("does not load invalid negative amounts", () => {
    const saved = storage();
    saved.setItem("game-devis-last-prices", '{"game-a:":-4}');
    expect(resolveGameDevisPrice(loadGameDevisDefaults(saved).prices, "game-a", "", 10)).toBe(10);
  });
});

describe("Quote CRM contacts", () => {
  beforeEach(() => {
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockResolvedValue({ data: [{ id: "open", email: "contact@example.org" }, { id: "no-email", email: "" }], error: null });
  });
  it("requests only OPEN opportunities and usable recipient emails", async () => {
    const contacts = await fetchOpenGameDevisContacts();
    expect(query.eq).toHaveBeenCalledWith("sales_status", "OPEN");
    expect(contacts.map((contact) => contact.id)).toEqual(["open"]);
  });
});