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

/** Colonnes légères : exclut `raw_text` (parfois plusieurs centaines de Ko). */
const LIST_COLUMNS =
  "id, source, title, ai_title, external_id, summary, tags, duration_seconds, status, error_message, metadata, editorial_qualification, editorial_analysis, editorial_analyzed_at, created_at, updated_at";

export type TranscriptListItem = Omit<Transcript, "raw_text">;

interface UseTranscriptsPageOptions extends UseTranscriptsOptions {
  /** Filtre de qualification éditoriale ("editorial", "none" ou une valeur exacte). */
  qualification?: string;
  page: number;
  pageSize: number;
}

/**
 * Liste paginée côté serveur (range + count exact), sans `raw_text`.
 * Tri par date de création décroissante (assuré par Postgres, pas en mémoire).
 */
export function useTranscriptsPage({
  search,
  source,
  status,
  trashed,
  qualification,
  page,
  pageSize,
}: UseTranscriptsPageOptions) {
  return useQuery({
    queryKey: ["transcripts-page", { search, source, status, trashed, qualification, page, pageSize }],
    queryFn: async () => {
      let q = (supabase as any)
        .from("transcripts")
        .select(LIST_COLUMNS, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);

      if (trashed) q = q.eq("status", "trashed");
      else if (status) q = q.eq("status", status);
      else q = q.neq("status", "trashed");
      if (source) q = q.eq("source", source);
      if (search) q = q.ilike("title", `%${search}%`);
      if (qualification === "none") q = q.is("editorial_qualification", null);
      else if (qualification === "editorial") q = q.eq("editorial_qualification", "pro_exploitable");
      else if (qualification) q = q.eq("editorial_qualification", qualification);

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as TranscriptListItem[], total: count ?? 0 };
    },
  });
}

/** Compteurs KPI via `head: true` : aucune ligne transférée. */
export function useTranscriptCounts(source?: TranscriptSource | "") {
  return useQuery({
    queryKey: ["transcripts-counts", source],
    queryFn: async () => {
      const countFor = async (build: (q: any) => any) => {
        let q = (supabase as any).from("transcripts").select("id", { count: "exact", head: true });
        if (source) q = q.eq("source", source);
        const { count, error } = await build(q);
        if (error) throw error;
        return count ?? 0;
      };
      const [total, ready, processing, trashed] = await Promise.all([
        countFor((q) => q.neq("status", "trashed")),
        countFor((q) => q.eq("status", "ready")),
        countFor((q) => q.eq("status", "processing")),
        countFor((q) => q.eq("status", "trashed")),
      ]);
      return { total, ready, processing, trashed };
    },
  });
}

/** Récupère le texte brut d'un transcript à la demande (copie depuis la liste). */
export async function fetchTranscriptRawText(id: string): Promise<string | null> {
  const { data, error } = await (supabase as any)
    .from("transcripts")
    .select("raw_text")
    .eq("id", id)
    .single();
  if (error) throw error;
  return (data?.raw_text as string | null) ?? null;
}

export function useTranscripts({ search, source, status, trashed }: UseTranscriptsOptions = {}) {
  return useQuery({
    queryKey: ["transcripts", search, source, status, trashed ? "trashed" : "active"],
    queryFn: async () => {
      let q = (supabase as any)
        .from("transcripts")
        .select("*")
        .limit(1000);

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
      const rows = (data as Transcript[]) ?? [];
      const meetingDate = (t: Transcript) => {
        const m: any = t.metadata ?? {};
        return new Date(m.fireflies_date ?? m.file_date ?? t.created_at).getTime();
      };
      rows.sort((a, b) => meetingDate(b) - meetingDate(a));
      return rows;
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
