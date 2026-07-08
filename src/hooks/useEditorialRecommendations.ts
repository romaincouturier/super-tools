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
  decision_reason: RejectReason | null;
  theme_id: string | null;
  signal_count: number;
  created_at: string;
}

export type RejectReason = "trop_generique" | "deja_couvert" | "mauvaise_cible" | "sujet_sensible" | "pas_le_moment" | "autre";

export const REJECT_REASON_LABELS: Record<RejectReason, string> = {
  trop_generique: "Trop générique",
  deja_couvert: "Déjà couvert",
  mauvaise_cible: "Mauvaise cible",
  sujet_sensible: "Sujet sensible",
  pas_le_moment: "Pas le moment",
  autre: "Autre",
};

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
    mutationFn: async ({ rec, decision, note, reason }: {
      rec: EditorialRecommendation;
      decision: "accepted" | "rejected" | "discuss";
      note?: string;
      reason?: RejectReason;
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
          decision_reason: decision === "rejected" ? (reason ?? null) : null,
        })
        .eq("id", rec.id);
      if (error) throw error;
      return { cardId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["editorial-recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["editorial-alignment"] });
    },
  });
}

export interface EditorialAlignment {
  decided: number;
  accepted: number;
  acceptanceRate: number | null;
  highScoreAcceptance: number | null;
  lowScoreAcceptance: number | null;
  byUnivers: Array<{ univers: string; accepted: number; total: number }>;
  topRejectReasons: Array<{ reason: string; count: number }>;
}

export function useEditorialAlignment() {
  return useQuery({
    queryKey: ["editorial-alignment"],
    queryFn: async (): Promise<EditorialAlignment> => {
      const { data, error } = await (supabase as any)
        .from("editorial_recommendations")
        .select("status, score_priorite, univers, decision_reason")
        .neq("status", "pending");
      if (error) throw error;
      const rows = (data ?? []) as Array<{ status: string; score_priorite: number | null; univers: string | null; decision_reason: string | null }>;

      const rate = (subset: typeof rows) =>
        subset.length ? Math.round((subset.filter((r) => r.status === "accepted").length / subset.length) * 100) : null;

      const high = rows.filter((r) => (r.score_priorite ?? 0) >= 70);
      const low = rows.filter((r) => (r.score_priorite ?? 0) < 70);

      const byUniversMap = new Map<string, { accepted: number; total: number }>();
      for (const r of rows) {
        const u = r.univers ?? "autre";
        const cur = byUniversMap.get(u) ?? { accepted: 0, total: 0 };
        cur.total++;
        if (r.status === "accepted") cur.accepted++;
        byUniversMap.set(u, cur);
      }

      const reasonMap = new Map<string, number>();
      for (const r of rows) {
        if (r.status === "rejected" && r.decision_reason) {
          reasonMap.set(r.decision_reason, (reasonMap.get(r.decision_reason) ?? 0) + 1);
        }
      }

      return {
        decided: rows.length,
        accepted: rows.filter((r) => r.status === "accepted").length,
        acceptanceRate: rate(rows),
        highScoreAcceptance: rate(high),
        lowScoreAcceptance: rate(low),
        byUnivers: [...byUniversMap.entries()]
          .map(([univers, v]) => ({ univers, ...v }))
          .sort((a, b) => b.total - a.total),
        topRejectReasons: [...reasonMap.entries()]
          .map(([reason, count]) => ({ reason, count }))
          .sort((a, b) => b.count - a.count),
      };
    },
  });
}
