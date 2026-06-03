import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Transcript } from "./useTranscripts";

export interface CardTranscriptLink {
  id: string;
  card_id: string;
  transcript_id: string;
  created_at: string;
  transcript: Transcript;
}

export function useCardTranscripts(cardId: string | null) {
  return useQuery({
    queryKey: ["card-transcripts", cardId],
    enabled: !!cardId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("crm_card_transcripts")
        .select("id, card_id, transcript_id, created_at, transcript:transcripts(*)")
        .eq("card_id", cardId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as CardTranscriptLink[];
    },
  });
}

export function useAssociateTranscript() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ cardId, transcriptId }: { cardId: string; transcriptId: string }) => {
      const { error } = await (supabase as any)
        .from("crm_card_transcripts")
        .insert({ card_id: cardId, transcript_id: transcriptId, created_by: user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: (_d, { cardId }) => {
      qc.invalidateQueries({ queryKey: ["card-transcripts", cardId] });
    },
  });
}

export function useUnlinkTranscript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ linkId }: { linkId: string; cardId: string }) => {
      const { error } = await (supabase as any)
        .from("crm_card_transcripts")
        .delete()
        .eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: (_d, { cardId }) => {
      qc.invalidateQueries({ queryKey: ["card-transcripts", cardId] });
    },
  });
}
