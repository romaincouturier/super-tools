import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchGameQuoteDrafts, sendGameQuoteDraft } from '@/services/gameQuoteDrafts';

export function useGameQuoteDrafts() {
  return useQuery({ queryKey: ['game-quote-drafts'], queryFn: fetchGameQuoteDrafts });
}

export function useSendGameQuoteDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sendGameQuoteDraft,
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['game-quote-drafts'] }),
        qc.invalidateQueries({ queryKey: ['game-devis-history'] }),
      ]);
    },
  });
}