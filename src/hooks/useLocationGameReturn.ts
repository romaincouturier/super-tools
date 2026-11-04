import { useMutation, useQueryClient } from "@tanstack/react-query";
import { confirmLocationGameReturn } from "@/services/locationGameReturn";

export function useLocationGameReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: confirmLocationGameReturn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-items"] });
      qc.invalidateQueries({ queryKey: ["order-items-all"] });
      qc.invalidateQueries({ queryKey: ["order-kpis"] });
    },
  });
}