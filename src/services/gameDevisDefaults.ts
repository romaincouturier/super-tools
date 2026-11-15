import { supabase } from "@/integrations/supabase/client";

export interface GameDevisContact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company: string | null;
  title: string;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  siren: string | null;
}

export async function fetchOpenGameDevisContacts(): Promise<GameDevisContact[]> {
  const { data, error } = await supabase.from("crm_cards")
    .select("id, first_name, last_name, email, company, title, address, postal_code, city, siren")
    .eq("sales_status", "OPEN")
    .order("last_name", { ascending: true });
  if (error) throw error;
  return (data ?? []).filter((contact) => contact.email?.trim());
}

export interface GameDevisDefaults {
  fraisDePort?: number | "";
  fraisDossier?: number | "";
  prices: Record<string, number>;
}

const FEES_KEY = "game-devis-last-fees";
const PRICES_KEY = "game-devis-last-prices";

export function loadGameDevisDefaults(storage: Pick<Storage, "getItem">): GameDevisDefaults {
  const fees = JSON.parse(storage.getItem(FEES_KEY) ?? "{}");
  const prices = JSON.parse(storage.getItem(PRICES_KEY) ?? "{}");
  const validAmount = (value: unknown) => value === "" || (typeof value === "number" && Number.isFinite(value) && value >= 0);
  return {
    fraisDePort: validAmount(fees?.fraisDePort) ? fees.fraisDePort : undefined,
    fraisDossier: validAmount(fees?.fraisDossier) ? fees.fraisDossier : undefined,
    prices: Object.fromEntries(Object.entries(prices ?? {}).filter(([, value]) => typeof value === "number" && Number.isFinite(value) && value >= 0)) as Record<string, number>,
  };
}

export function saveGameDevisFees(storage: Pick<Storage, "setItem">, fees: Pick<GameDevisDefaults, "fraisDePort" | "fraisDossier">) {
  storage.setItem(FEES_KEY, JSON.stringify(fees));
}

export function saveGameDevisPrice(storage: Pick<Storage, "getItem" | "setItem">, gameId: string, optionId: string, price: number) {
  const prices = JSON.parse(storage.getItem(PRICES_KEY) ?? "{}");
  storage.setItem(PRICES_KEY, JSON.stringify({ ...prices, [`${gameId}:${optionId}`]: price }));
}

export function resolveGameDevisPrice(prices: Record<string, number>, gameId: string, optionId: string, catalogPrice: number) {
  return prices[`${gameId}:${optionId}`] ?? catalogPrice;
}
export async function fetchSharedGameDevisDefaults(): Promise<GameDevisDefaults> {
  const { data, error } = await supabase.from("game_quote_defaults").select("key,amount");
  if (error) throw error;
  return defaultsFromRows(data ?? []);
}

export function defaultsFromRows(rows: Array<{ key: string; amount: number | string }>): GameDevisDefaults {
  const defaults: GameDevisDefaults = { prices: {} };
  for (const row of rows) {
    const amount = Number(row.amount);
    if (!Number.isFinite(amount) || amount < 0) continue;
    if (row.key === "shipping") defaults.fraisDePort = amount;
    else if (row.key === "admin") defaults.fraisDossier = amount;
    else if (row.key.startsWith("price:")) defaults.prices[row.key.slice(6)] = amount;
  }
  return defaults;
}

export async function saveSharedGameDevisAmount(key: string, amount: number, onlyMissing = false) {
  const { error } = await supabase.rpc("save_game_quote_default", { p_key: key, p_amount: amount, p_only_missing: onlyMissing });
  if (error) throw error;
}

export async function migrateLocalGameDevisDefaults(storage: Pick<Storage, "getItem">) {
  const local = loadGameDevisDefaults(storage);
  for (const [key, amount] of Object.entries(local.prices)) await saveSharedGameDevisAmount(`price:${key}`, amount, true);
  if (typeof local.fraisDePort === "number") await saveSharedGameDevisAmount("shipping", local.fraisDePort, true);
  if (typeof local.fraisDossier === "number") await saveSharedGameDevisAmount("admin", local.fraisDossier, true);
}
