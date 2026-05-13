import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TranscriptSource = "google_drive" | "fireflies";
export type TranscriptStatus = "pending" | "processing" | "ready" | "error";

export interface Transcript {
  id: string;
  source: TranscriptSource;
  title: string | null;
  external_id: string;
  raw_text: string | null;
  summary: string | null;
  tags: string[];
  duration_seconds: number | null;
  status: TranscriptStatus;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface UseTranscriptsOptions {
  search?: string;
  source?: TranscriptSource | "";
  status?: TranscriptStatus | "";
}

export function useTranscripts({ search, source, status }: UseTranscriptsOptions = {}) {
  return useQuery({
    queryKey: ["transcripts", search, source, status],
    queryFn: async () => {
      let q = (supabase as any)
        .from("transcripts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (source) q = q.eq("source", source);
      if (status) q = q.eq("status", status);
      if (search) q = q.ilike("title", `%${search}%`);

      const { data, error } = await q;
      if (error) throw error;
      return data as Transcript[];
    },
  });
}

export function useTranscript(id: string | null) {
  return useQuery({
    queryKey: ["transcript", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("transcripts")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Transcript;
    },
  });
}

export function useRetriggerTranscriptIndexation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await supabase.functions.invoke("index-documents", {
        body: { source_type: "transcript", source_id: id },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transcripts"] }),
  });
}
