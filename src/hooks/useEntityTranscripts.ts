import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Transcript } from "./useTranscripts";

export type TranscriptEntity = "crm_card" | "event";

interface EntityConfig {
  table: string;
  fk: string;
}

const CONFIG: Record<TranscriptEntity, EntityConfig> = {
  crm_card: { table: "crm_card_transcripts", fk: "card_id" },
  event: { table: "event_transcripts", fk: "event_id" },
};

export interface EntityTranscriptLink {
  id: string;
  transcript_id: string;
  created_at: string;
  transcript: Transcript;
}

export function useEntityTranscripts(entity: TranscriptEntity, entityId: string | null) {
  const { table, fk } = CONFIG[entity];
  return useQuery({
    queryKey: ["entity-transcripts", entity, entityId],
    enabled: !!entityId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(table)
        .select(`id, ${fk}, transcript_id, created_at, transcript:transcripts(*)`)
        .eq(fk, entityId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as EntityTranscriptLink[];
    },
  });
}

export function useAssociateEntityTranscript(entity: TranscriptEntity) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { table, fk } = CONFIG[entity];
  return useMutation({
    mutationFn: async ({ entityId, transcriptId }: { entityId: string; transcriptId: string }) => {
      const { error } = await (supabase as any)
        .from(table)
        .upsert(
          { [fk]: entityId, transcript_id: transcriptId, created_by: user?.id ?? null },
          { onConflict: `${fk},transcript_id`, ignoreDuplicates: true },
        );
      if (error) throw error;
    },
    onSuccess: (_d, { entityId }) => {
      qc.invalidateQueries({ queryKey: ["entity-transcripts", entity, entityId] });
    },
  });
}

export function useUnlinkEntityTranscript(entity: TranscriptEntity) {
  const qc = useQueryClient();
  const { table } = CONFIG[entity];
  return useMutation({
    mutationFn: async ({ linkId }: { linkId: string; entityId: string }) => {
      const { error } = await (supabase as any).from(table).delete().eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: (_d, { entityId }) => {
      qc.invalidateQueries({ queryKey: ["entity-transcripts", entity, entityId] });
    },
  });
}
