import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelDevisOrder,
  createDevisOrder,
  fetchActiveDevisOrder,
  fetchLatestGameDevis,
  fetchOrderableGames,
  type CreateDevisOrderInput,
} from "@/services/devisOrders";

export function useLatestGameDevis(cardId: string | null | undefined) {
  return useQuery({
    queryKey: ["latest-game-devis", cardId],
    queryFn: () => fetchLatestGameDevis(cardId!),
    enabled: !!cardId,
  });
}

export function useActiveDevisOrder(cardId: string | null | undefined) {
  return useQuery({
    queryKey: ["active-devis-order", cardId],
    queryFn: () => fetchActiveDevisOrder(cardId!),
    enabled: !!cardId,
  });
}

export function useOrderableGames(enabled: boolean) {
  return useQuery({ queryKey: ["orderable-games"], queryFn: fetchOrderableGames, enabled });
}

export function useCreateDevisOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDevisOrderInput) => createDevisOrder(input),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["active-devis-order", v.crmCardId] });
      qc.invalidateQueries({ queryKey: ["supertilt-order-items"] });
    },
  });
}

export function useCancelDevisOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) => cancelDevisOrder(orderId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["active-devis-order"] });
      qc.invalidateQueries({ queryKey: ["supertilt-order-items"] });
    },
  });
}
