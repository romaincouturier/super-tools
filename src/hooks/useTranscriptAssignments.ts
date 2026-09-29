import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TranscriptAssignmentKind = "opportunity" | "event" | "mission" | "lesson";

export interface TranscriptAssignment {
  transcript_id: string;
  kind: TranscriptAssignmentKind;
  entity_id: string;
  label: string;
}

export const ASSIGNMENT_KIND_LABELS: Record<TranscriptAssignmentKind, string> = {
  opportunity: "Opportunité",
  event: "Événement",
  mission: "Mission",
  lesson: "Leçon",
};

export const TRANSCRIPT_ASSIGNMENTS_KEY = ["transcript-assignments"];

export function useTranscriptAssignments() {
  return useQuery({
    queryKey: TRANSCRIPT_ASSIGNMENTS_KEY,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_transcript_assignments");
      if (error) throw error;
      const map = new Map<string, TranscriptAssignment[]>();
      for (const row of (data || []) as TranscriptAssignment[]) {
        const list = map.get(row.transcript_id) ?? [];
        list.push(row);
        map.set(row.transcript_id, list);
      }
      return map;
    },
  });
}

export function describeAssignments(list: TranscriptAssignment[] | undefined): string {
  if (!list?.length) return "";
  return list.map((a) => `${ASSIGNMENT_KIND_LABELS[a.kind]} : ${a.label}`).join("\n");
}

/**
 * Dissocie un transcript d'une entité. Pour une mission ou une leçon, la page
 * ou la leçon créée est conservée : seul le lien vers le transcript est retiré.
 */
export function useUnassignTranscript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: TranscriptAssignment) => {
      const db = supabase as any;
      let res;
      if (a.kind === "opportunity") {
        res = await db.from("crm_card_transcripts").delete().eq("card_id", a.entity_id).eq("transcript_id", a.transcript_id);
      } else if (a.kind === "event") {
        res = await db.from("event_transcripts").delete().eq("event_id", a.entity_id).eq("transcript_id", a.transcript_id);
      } else if (a.kind === "mission") {
        res = await db.from("mission_pages").update({ source_transcript_id: null }).eq("mission_id", a.entity_id).eq("source_transcript_id", a.transcript_id);
      } else {
        res = await db.from("lms_lessons").update({ source_transcript_id: null }).eq("id", a.entity_id).eq("source_transcript_id", a.transcript_id);
      }
      if (res.error) throw res.error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TRANSCRIPT_ASSIGNMENTS_KEY });
      qc.invalidateQueries({ queryKey: ["entity-transcripts"] });
    },
  });
}
