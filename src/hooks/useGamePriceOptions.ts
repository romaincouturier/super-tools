import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type GameOfferType = "location" | "vente";

export interface GamePriceOption {
  id: string;
  game_id: string;
  offer_type: GameOfferType;
  label: string;
  prix: number;
  woocommerce_variation_id: number | null;
  display_order: number;
}

export const OFFER_TYPE_LABELS: Record<GameOfferType, string> = {
  location: "Location",
  vente: "Vente",
};

/** Libellé affiché pour un tarif : « Location — 1 semaine » ou « Vente ». */
export function priceOptionLabel(o: Pick<GamePriceOption, "offer_type" | "label">): string {
  const base = OFFER_TYPE_LABELS[o.offer_type] ?? o.offer_type;
  return o.label?.trim() ? `${base} — ${o.label.trim()}` : base;
}

/** Tarifs d'un jeu, ou tous les tarifs si gameId non fourni. */
export function useGamePriceOptions(gameId?: string) {
  return useQuery({
    queryKey: ["game-price-options", gameId ?? "all"],
    queryFn: async () => {
      let q = (supabase as any)
        .from("game_price_options")
        .select("*")
        .order("display_order", { ascending: true });
      if (gameId) q = q.eq("game_id", gameId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as GamePriceOption[];
    },
  });
}

/** Remplace l'intégralité des tarifs d'un jeu. */
export function useReplaceGamePriceOptions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      gameId,
      options,
    }: {
      gameId: string;
      options: Array<Omit<GamePriceOption, "id" | "game_id" | "display_order">>;
    }) => {
      const del = await (supabase as any).from("game_price_options").delete().eq("game_id", gameId);
      if (del.error) throw del.error;
      if (!options.length) return;
      const rows = options.map((o, idx) => ({
        game_id: gameId,
        offer_type: o.offer_type,
        label: o.label ?? "",
        prix: o.prix ?? 0,
        woocommerce_variation_id: o.woocommerce_variation_id ?? null,
        display_order: idx,
      }));
      const { error } = await (supabase as any).from("game_price_options").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["game-price-options"] });
    },
  });
}
