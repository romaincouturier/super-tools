import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── Types ────────────────────────────────────────────────────────────

export interface GameAuthor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  royalty_rate: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Game {
  id: string;
  author_id: string | null;
  title: string;
  description: string | null;
  woocommerce_product_id: number | null;
  cover_url: string | null;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
  game_authors?: GameAuthor;
}

export interface GameSale {
  id: string;
  game_id: string | null;
  woocommerce_order_id: string;
  customer_name: string | null;
  customer_email: string | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  royalty_amount: number;
  sale_date: string;
  status: "pending" | "paid";
  created_at: string;
  games?: { title: string; game_authors?: { name: string } };
}

// ── Game Authors ─────────────────────────────────────────────────────

export function useGameAuthors() {
  return useQuery({
    queryKey: ["game-authors"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("game_authors")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as GameAuthor[];
    },
  });
}

export function useUpsertGameAuthor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<GameAuthor> & { name: string }) => {
      const { data, error } = payload.id
        ? await (supabase as any).from("game_authors").update(payload).eq("id", payload.id).select().single()
        : await (supabase as any).from("game_authors").insert(payload).select().single();
      if (error) throw error;
      return data as GameAuthor;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["game-authors"] }),
  });
}

export function useDeleteGameAuthor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("game_authors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["game-authors"] }),
  });
}

// ── Games ────────────────────────────────────────────────────────────

export function useGames() {
  return useQuery({
    queryKey: ["games"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("games")
        .select("*, game_authors(name, royalty_rate)")
        .order("title");
      if (error) throw error;
      return data as Game[];
    },
  });
}

export function useUpsertGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Game> & { title: string }) => {
      const { data, error } = payload.id
        ? await (supabase as any).from("games").update(payload).eq("id", payload.id).select().single()
        : await (supabase as any).from("games").insert(payload).select().single();
      if (error) throw error;
      return data as Game;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["games"] }),
  });
}

export function useDeleteGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("games").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["games"] }),
  });
}

// ── Game Sales ───────────────────────────────────────────────────────

export function useGameSales(gameId?: string) {
  return useQuery({
    queryKey: ["game-sales", gameId],
    queryFn: async () => {
      let q = (supabase as any)
        .from("game_sales")
        .select("*, games(title, game_authors(name))")
        .order("sale_date", { ascending: false })
        .limit(200);
      if (gameId) q = q.eq("game_id", gameId);
      const { data, error } = await q;
      if (error) throw error;
      return data as GameSale[];
    },
  });
}

export function useGameSalesKpis() {
  return useQuery({
    queryKey: ["game-sales-kpis"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("game_sales")
        .select("total_amount, royalty_amount, game_id, sale_date, games(title)");
      if (error) throw error;
      const rows = data as Array<{
        total_amount: number;
        royalty_amount: number;
        game_id: string;
        sale_date: string;
        games: { title: string } | null;
      }>;

      const totalRevenue = rows.reduce((s, r) => s + r.total_amount, 0);
      const totalRoyalties = rows.reduce((s, r) => s + r.royalty_amount, 0);

      const byGame = new Map<string, { title: string; revenue: number; sales: number }>();
      for (const r of rows) {
        const title = r.games?.title ?? "Inconnu";
        const existing = byGame.get(r.game_id ?? "") ?? { title, revenue: 0, sales: 0 };
        byGame.set(r.game_id ?? "", {
          title,
          revenue: existing.revenue + r.total_amount,
          sales: existing.sales + 1,
        });
      }

      const topGames = [...byGame.values()]
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      return { totalRevenue, totalRoyalties, totalSales: rows.length, topGames };
    },
  });
}

// ── Game Devis History ───────────────────────────────────────────────

export interface GameDevisHistoryEntry {
  id: string;
  created_at: string;
  recipient_email: string;
  client_name: string | null;
  total_amount: number;
  items: GameDevisItem[];
  pdf_url: string | null;
}

export interface GameDevisItem {
  title: string;
  quantity: number;
  unitPrice: number;
}

export function useGameDevisHistory() {
  return useQuery({
    queryKey: ["game-devis-history"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("activity_logs")
        .select("id, created_at, recipient_email, details")
        .eq("action_type", "game_devis_sent")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data as Array<{ id: string; created_at: string; recipient_email: string; details: any }>).map((r) => ({
        id: r.id,
        created_at: r.created_at,
        recipient_email: r.recipient_email,
        client_name: r.details?.client_name ?? null,
        total_amount: r.details?.total_amount ?? 0,
        items: r.details?.items ?? [],
        pdf_url: r.details?.pdf_url ?? null,
      })) as GameDevisHistoryEntry[];
    },
  });
}

export function useMarkSalesPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await (supabase as any)
        .from("game_sales")
        .update({ status: "paid" })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["game-sales"] });
      qc.invalidateQueries({ queryKey: ["game-sales-kpis"] });
    },
  });
}

export function useDeleteGameSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("game_sales")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["game-sales"] });
      qc.invalidateQueries({ queryKey: ["game-sales-kpis"] });
    },
  });
}
