import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = ["faq-items"];

export function useFaqItems(onlyActive = false) {
  return useQuery({
    queryKey: [...QUERY_KEY, onlyActive],
    queryFn: async (): Promise<FaqItem[]> => {
      let q = supabase.from("faq_items").select("*").order("position", { ascending: true });
      if (onlyActive) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as FaqItem[];
    },
  });
}

export function useCreateFaqItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Pick<FaqItem, "question" | "answer" | "position">) => {
      const { data, error } = await supabase.from("faq_items").insert(input).select().single();
      if (error) throw error;
      return data as FaqItem;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateFaqItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FaqItem> }) => {
      const { error } = await supabase.from("faq_items").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteFaqItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("faq_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
