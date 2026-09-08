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

/**
 * Contenu complet d'un transcript, pour la copie dans le presse-papier.
 *
 * Vit ici et non dans le composant : la règle [014b] veut que l'accès aux
 * données passe par un hook ou un service, jamais par `src/components`.
 */
export async function fetchTranscriptContent(transcriptId: string): Promise<{
  ai_title: string | null;
  title: string | null;
  summary: string | null;
  raw_text: string | null;
} | null> {
  const { data, error } = await (supabase as unknown as { from: typeof supabase.from })
    .from("transcripts")
    .select("ai_title,title,summary,raw_text")
    .eq("id", transcriptId)
    .single();
  if (error || !data) return null;
  return data as {
    ai_title: string | null;
    title: string | null;
    summary: string | null;
    raw_text: string | null;
  };
}
