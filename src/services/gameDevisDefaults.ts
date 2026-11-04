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