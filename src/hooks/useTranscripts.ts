import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TranscriptSource = "google_drive" | "fireflies";
export type TranscriptStatus = "pending" | "processing" | "ready" | "error" | "trashed";

export type EditorialQualification =
  | "pro_exploitable"
  | "pro_archiver"
  | "personnel_hors_sujet"
  | "sensible_confidentiel"
  | "non_exploitable";

export interface EditorialAnalysis {
  univers: string;
  type_matiere: string;
  resume_editorial: string;
  signaux: string[];
  risque_confidentialite: "faible" | "moyen" | "fort";
  risque_justification: string;
}

export interface Transcript {
  id: string;
  source: TranscriptSource;
  title: string | null;
  ai_title: string | null;
  external_id: string;
  raw_text: string | null;
  summary: string | null;
  tags: string[];
  duration_seconds: number | null;
  status: TranscriptStatus;
  error_message: string | null;
  metadata: Record<string, unknown>;
  editorial_qualification: EditorialQualification | null;
  editorial_analysis: EditorialAnalysis | null;
  editorial_analyzed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface UseTranscriptsOptions {
  search?: string;
  source?: TranscriptSource | "";
  status?: TranscriptStatus | "";
  /** When true, returns only trashed transcripts. Overrides `status`. */
  trashed?: boolean;
}

export function useTranscripts({ search, source, status, trashed }: UseTranscriptsOptions = {}) {
  return useQuery({
    queryKey: ["transcripts", search, source, status, trashed ? "trashed" : "active"],
    queryFn: async () => {
      let q = (supabase as any)
        .from("transcripts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (trashed) {
        q = q.eq("status", "trashed");
      } else if (status) {
        q = q.eq("status", status);
      } else {
        q = q.neq("status", "trashed");
      }
      if (source) q = q.eq("source", source);
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

export function useTrashTranscript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any)
        .from("transcripts")
        .update({ status: "trashed" })
        .eq("id", id)
        .select("id");
      if (error) throw error;
      // La RLS peut bloquer sans erreur (0 ligne) : on le signale explicitement.
      if (!data || data.length === 0) throw new Error("Suppression refusée (droits insuffisants).");
    },
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["transcripts"] });
      qc.invalidateQueries({ queryKey: ["transcript", id] });
    },
  });
}

export function useRestoreTranscript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TranscriptStatus }) => {
      const { error } = await (supabase as any)
        .from("transcripts")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ["transcripts"] });
      qc.invalidateQueries({ queryKey: ["transcript", id] });
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
