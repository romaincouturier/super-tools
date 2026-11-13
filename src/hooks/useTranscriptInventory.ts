import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { controlTranscriptInventory, fetchTranscriptInventories } from "@/services/transcriptInventory";
import { toast } from "@/lib/toast";

export function useTranscriptInventories() {
  return useQuery({ queryKey: ["transcript-inventories"], queryFn: fetchTranscriptInventories });
}

export function useTranscriptInventoryControl() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: controlTranscriptInventory,
    onSettled: () => {
      client.invalidateQueries({ queryKey: ["transcript-inventories"] });
      client.invalidateQueries({ queryKey: ["transcripts"] });
      client.invalidateQueries({ queryKey: ["transcripts-page"] });
      client.invalidateQueries({ queryKey: ["transcripts-counts"] });
      client.invalidateQueries({ queryKey: ["transcript"] });
    },
    onError: (error: Error) => toast.error(error.message, { cause: error }),
  });
}