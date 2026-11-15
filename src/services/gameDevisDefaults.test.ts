import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.hoisted(() => ({ select: vi.fn(), eq: vi.fn(), order: vi.fn(), rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => query, rpc: query.rpc } }));
import { fetchOpenGameDevisContacts, loadGameDevisDefaults, resolveGameDevisPrice, saveGameDevisFees, saveGameDevisPrice, fetchSharedGameDevisDefaults, migrateLocalGameDevisDefaults, saveSharedGameDevisAmount } from "./gameDevisDefaults";

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

describe("Montants partagés sans stockage navigateur", () => {
  it("relit le prix et les frais enregistrés depuis un autre appareil", async () => {
    query.select.mockResolvedValue({ data: [{ key: "price:game-a:rental", amount: "59" }, { key: "shipping", amount: "15.75" }, { key: "admin", amount: "0" }], error: null });
    expect(await fetchSharedGameDevisDefaults()).toEqual({ prices: { "game-a:rental": 59 }, fraisDePort: 15.75, fraisDossier: 0 });
  });
  it("enregistre le prix dans la base avec les droits de la session", async () => {
    query.rpc.mockResolvedValue({ error: null });
    await saveSharedGameDevisAmount("price:game-a:rental", 59);
    expect(query.rpc).toHaveBeenLastCalledWith("save_game_quote_default", { p_key: "price:game-a:rental", p_amount: 59, p_only_missing: false });
  });
  it("importe les valeurs locales sans écraser une valeur partagée", async () => {
    query.rpc.mockClear().mockResolvedValue({ error: null });
    const local = storage();
    saveGameDevisPrice(local, "game-a", "rental", 30);
    await migrateLocalGameDevisDefaults(local);
    expect(query.rpc).toHaveBeenCalledWith("save_game_quote_default", { p_key: "price:game-a:rental", p_amount: 30, p_only_missing: true });
  });
  it("signale un refus de sauvegarde au lieu de prétendre avoir mémorisé", async () => {
    query.rpc.mockResolvedValue({ error: new Error("Accès dropshipping requis") });
    await expect(saveSharedGameDevisAmount("admin", 5)).rejects.toThrow("Accès dropshipping requis");
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