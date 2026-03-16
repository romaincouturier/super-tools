import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export const CRM_QUERY_KEY = "crm-board";

/** Shared mutation factory to eliminate repeated queryClient/toast boilerplate. */
export function useCrmMutation<TInput, TOutput = void>(
  mutationFn: (input: TInput) => Promise<TOutput>,
  options?: {
    successMessage?: string;
    invalidateKey?: string[];
  }
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: options?.invalidateKey ?? [CRM_QUERY_KEY],
      });
      if (options?.successMessage) {
        toast({ title: options.successMessage });
      }
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Erreur inconnue";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    },
  });
}
