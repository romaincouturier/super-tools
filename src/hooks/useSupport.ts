import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchSupportTickets, fetchAllSupportTicketsForStats, createSupportTicket, updateSupportTicket, moveSupportTicket, analyzeTicket } from "@/services/support";
import { supabase } from "@/integrations/supabase/client";
import type { SupportTicket, TicketStatus } from "@/types/support";

const QUERY_KEY = ["support-tickets"];
const MY_QUERY_KEY = ["my-support-tickets"];

export function useSupportTickets() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchSupportTickets,
    // Le pipeline auto-coding (workflow GitHub) fait évoluer coding_status
    // hors de l'app : on rafraîchit pour voir queued -> running -> done/error.
    refetchInterval: 30_000,
  });
}

/** Tous les tickets (archivés inclus, boîte à idées exclus) pour les cartes de contrôle. */
export function useSupportTicketsForStats() {
  return useQuery({
    queryKey: ["support-tickets-stats"],
    queryFn: fetchAllSupportTicketsForStats,
    staleTime: 60_000,
  });
}

/** Tickets submitted by the currently authenticated user, newest first. */
export function useMySupportTickets() {
  return useQuery({
    queryKey: MY_QUERY_KEY,
    queryFn: async (): Promise<SupportTicket[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("submitted_by", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data || []) as unknown) as SupportTicket[];
    },
  });
}

export function useCreateSupportTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSupportTicket,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: MY_QUERY_KEY });
    },
  });
}

export function useUpdateSupportTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<SupportTicket> }) =>
      updateSupportTicket(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useMoveSupportTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, position }: { id: string; status: TicketStatus; position: number }) =>
      moveSupportTicket(id, status, position),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useAnalyzeTicket() {
  return useMutation({
    mutationFn: (description: string) => analyzeTicket(description),
  });
}
