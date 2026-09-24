import { useQuery } from "@tanstack/react-query";
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
