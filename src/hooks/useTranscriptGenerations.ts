import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/toast";

export type GenerationKind = "blog_article" | "linkedin_post";

export interface GenerationVariant {
  title: string;
  content: string;
}

export interface TranscriptGeneration {
  id: string;
  transcript_id: string;
  kind: GenerationKind;
  content: string;
  title_suggestion: string | null;
  variants: GenerationVariant[];
  tags: string[];
  model: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useTranscriptGenerations(transcriptId: string | null) {
  return useQuery({
    queryKey: ["transcript_generations", transcriptId],
    enabled: !!transcriptId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("transcript_generations")
        .select("*")
        .eq("transcript_id", transcriptId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as TranscriptGeneration[];
    },
  });
}

export function useGenerateTranscriptContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { transcript_id: string; kind: GenerationKind }) => {
      const res = await supabase.functions.invoke("generate-transcript-content", {
        body: vars,
      });
      if (res.error) throw new Error(res.error.message ?? "Erreur génération");
      return res.data?.generation as TranscriptGeneration;
    },
    onSuccess: (gen) => {
      qc.invalidateQueries({ queryKey: ["transcript_generations", gen.transcript_id] });
      toast.success("Contenu généré");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateTranscriptGeneration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; transcript_id: string; content?: string; tags?: string[]; title_suggestion?: string | null; variants?: GenerationVariant[] }) => {
      const { id, transcript_id, ...patch } = vars;
      const { error } = await (supabase as any)
        .from("transcript_generations")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
      return { transcript_id };
    },
    onSuccess: ({ transcript_id }) => {
      qc.invalidateQueries({ queryKey: ["transcript_generations", transcript_id] });
    },
  });
}

export function useSupertiltContentTags() {
  return useQuery({
    queryKey: ["supertilt_content_tags"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "supertilt_content_tags")
        .maybeSingle();
      try {
        const v = data?.setting_value as unknown;
        if (Array.isArray(v)) return v as string[];
        return JSON.parse((v as string) ?? "[]") as string[];
      } catch {
        return [] as string[];
      }
    },
  });
}
