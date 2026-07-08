import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EditorialRecommendation {
  id: string;
  source_type: "transcript" | "feedback";
  transcript_id: string | null;
  training_id: string | null;
  signal_text: string;
  titre_provisoire: string;
  besoin_cible: string;
  type_besoin: string | null;
  cibles: string[];
  univers: string | null;
  format_recommande: string | null;
  contenus_existants_proches: Array<{
    wp_article_id?: string;
    title?: string;
    url?: string;
    similarity?: number;
    published_at?: string;
    views?: number | null;
    popularity?: "forte" | "moyenne" | "faible" | null;
    internal_note?: string | null;
    gsc?: { clicks: number; impressions: number; ctr: number; position: number } | null;
  }>;
  niveau_couverture: string | null;
  donnees_performance: { sources_disponibles?: string[] };
  niveau_demande: string | null;
  risque_redondance: string | null;
  action_recommandee: string;
  action_secondaire: string | null;
  score_besoin: number | null;
  score_creativite: number | null;
  score_seo: number | null;
  score_commercial: number | null;
  score_priorite: number | null;
  sensible: boolean;
  justification: string;
  prochaine_etape: string | null;
  status: "pending" | "accepted" | "rejected" | "discuss";
  card_id: string | null;
  decision_note: string | null;
  theme_id: string | null;
  signal_count: number;
  created_at: string;
}

export interface EngineRunResult {
  ok: boolean;
  signals_found: number;
  signals_clustered: number;
  themes_created: number;
  themes_pending: number;
  processed: number;
  remaining: number;
  embeddings_unavailable?: boolean;
  sources_disponibles: string[];
  results: Array<{ label: string; status: string; id?: string }>;
}

export interface BackfillRunResult {
  ok: boolean;
  processed: number;
  failed: number;
  remaining: number;
  rate_limited?: boolean;
}

export interface EditorialFunnel {
  transcriptsAQualifier: number;
  transcriptsExploitables: number;
  signauxNonClusterises: number;
  themesSansReco: number;
  recosEnAttente: number;
}

export function useEditorialRecommendations(status?: string, univers?: string) {
  return useQuery({
    queryKey: ["editorial-recommendations", status ?? "all", univers ?? "all"],
    queryFn: async (): Promise<EditorialRecommendation[]> => {
      let query = (supabase as any)
        .from("editorial_recommendations")
        .select("*")
        .order("score_priorite", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (status && status !== "all") query = query.eq("status", status);
      if (univers && univers !== "all") query = query.eq("univers", univers);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useEditorialFunnel() {
  return useQuery({
    queryKey: ["editorial-funnel"],
    queryFn: async (): Promise<EditorialFunnel> => {
      const [aQualifier, exploitables, clusterises, themesSansReco, recosPending] = await Promise.all([
        (supabase as any).from("transcripts").select("id", { count: "exact", head: true })
          .eq("status", "ready").not("raw_text", "is", null).is("editorial_qualification", null),
        (supabase as any).from("transcripts").select("id", { count: "exact", head: true })
          .eq("editorial_qualification", "pro_exploitable"),
        (supabase as any).from("editorial_theme_sources").select("id", { count: "exact", head: true })
          .eq("source_type", "transcript"),
        (supabase as any).from("editorial_themes").select("id", { count: "exact", head: true })
          .is("recommendation_id", null),
        (supabase as any).from("editorial_recommendations").select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      ]);
      return {
        transcriptsAQualifier: aQualifier.count ?? 0,
        transcriptsExploitables: exploitables.count ?? 0,
        signauxNonClusterises: Math.max(0, (exploitables.count ?? 0) - (clusterises.count ?? 0)),
        themesSansReco: themesSansReco.count ?? 0,
        recosEnAttente: recosPending.count ?? 0,
      };
    },
  });
}

async function invokeEditorialFunction<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const { data: session } = await supabase.auth.getSession();
  const response = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.session?.access_token ?? ""}`,
      "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export function useRunEditorialEngine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { transcript_id?: string; limit?: number }) =>
      invokeEditorialFunction<EngineRunResult>("editorial-engine", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["editorial-recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["editorial-funnel"] });
    },
  });
}

export function useRunEditorialBackfill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { limit?: number }) =>
      invokeEditorialFunction<BackfillRunResult>("editorial-backfill", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["editorial-funnel"] });
      queryClient.invalidateQueries({ queryKey: ["transcripts"] });
    },
  });
}

function buildCardDescription(rec: EditorialRecommendation): string {
  const proches = rec.contenus_existants_proches
    .map((p) => `- ${p.title ?? p.url} (similarité ${Math.round((p.similarity ?? 0) * 100)}%)`)
    .join("\n");
  return [
    `**Recommandation du moteur éditorial** (${rec.action_recommandee})`,
    "",
    `**Besoin cible détecté** : ${rec.besoin_cible}`,
    `**Cibles** : ${rec.cibles.join(", ")}`,
    `**Univers** : ${rec.univers ?? "—"}`,
    `**Format recommandé** : ${rec.format_recommande ?? "—"}`,
    `**Niveau de couverture existante** : ${rec.niveau_couverture ?? "—"}`,
    `**Niveau de demande** : ${rec.niveau_demande ?? "—"} · **Risque de redondance** : ${rec.risque_redondance ?? "—"}`,
    `**Scores** : priorité ${rec.score_priorite ?? "—"} · besoin ${rec.score_besoin ?? "—"} · créativité ${rec.score_creativite ?? "—"} · SEO ${rec.score_seo ?? "—"} · commercial ${rec.score_commercial ?? "—"}`,
    proches ? `**Contenus existants proches** :\n${proches}` : "",
    `**Justification** : ${rec.justification}`,
    rec.prochaine_etape ? `**Prochaine étape** : ${rec.prochaine_etape}` : "",
  ].filter(Boolean).join("\n");
}

export function useDecideRecommendation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ rec, decision, note }: {
      rec: EditorialRecommendation;
      decision: "accepted" | "rejected" | "discuss";
      note?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      let cardId: string | null = null;

      if (decision === "accepted") {
        const { data: column, error: colErr } = await (supabase as any)
          .from("content_columns")
          .select("id")
          .eq("name", "Idées")
          .maybeSingle();
        if (colErr || !column) throw new Error("Colonne « Idées » introuvable dans le kanban contenus.");

        const cardType = rec.format_recommande === "post_linkedin" ? "post" : "article";
        const { data: card, error: cardErr } = await (supabase as any)
          .from("content_cards")
          .insert({
            column_id: column.id,
            title: rec.titre_provisoire || "Recommandation éditoriale",
            description: buildCardDescription(rec),
            tags: [rec.univers, ...rec.cibles.slice(0, 3)].filter(Boolean),
            card_type: cardType,
            created_by: userData.user?.id ?? null,
          })
          .select("id")
          .single();
        if (cardErr) throw cardErr;
        cardId = card.id;
      }

      const { error } = await (supabase as any)
        .from("editorial_recommendations")
        .update({
          status: decision,
          card_id: cardId,
          decided_at: new Date().toISOString(),
          decided_by: userData.user?.id ?? null,
          decision_note: note ?? null,
        })
        .eq("id", rec.id);
      if (error) throw error;
      return { cardId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["editorial-recommendations"] });
    },
  });
}
