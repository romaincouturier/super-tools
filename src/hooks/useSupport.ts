import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchSupportTickets, createSupportTicket, updateSupportTicket, moveSupportTicket } from "@/services/support";
import type { SupportTicket, TicketStatus } from "@/types/support";

const QUERY_KEY = ["support-tickets"];

export function useSupportTickets() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchSupportTickets,
  });
}

export function useCreateSupportTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSupportTicket,
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
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
