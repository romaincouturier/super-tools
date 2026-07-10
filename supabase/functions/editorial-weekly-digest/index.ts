/**
 * editorial-weekly-digest
 *
 * Digest hebdomadaire du moteur éditorial, posté sur Slack (canal "article"
 * par défaut, surchargeable via le setting `slack_editorial_channel`) :
 * recommandations créées et arbitrées sur 7 jours, état de l'entonnoir,
 * alerte si le pipeline est bloqué (qualification qui stagne, échecs de cron).
 *
 * Auth : x-cron-secret (EDITORIAL_CRON_SECRET), x-internal-secret ou JWT.
 * Cron : lundi 07:00, à planifier DIRECTEMENT en base (règle [036]).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";

const REASON_LABELS: Record<string, string> = {
  trop_generique: "trop générique",
  deja_couvert: "déjà couvert",
  mauvaise_cible: "mauvaise cible",
  sujet_sensible: "sujet sensible",
  pas_le_moment: "pas le moment",
  autre: "autre",
};

Deno.serve(async (req) => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;
  if (req.method !== "POST") return createErrorResponse("Method not allowed", 405);

  try {
    const CRON_SECRET = Deno.env.get("EDITORIAL_CRON_SECRET") ?? "";
    const internalSecret = req.headers.get("x-internal-secret");
    const cronSecret = req.headers.get("x-cron-secret");
    const isInternal = (internalSecret && internalSecret === SERVICE_ROLE) ||
      (CRON_SECRET !== "" && cronSecret === CRON_SECRET);
    if (!isInternal) {
      const auth = req.headers.get("Authorization");
      if (!auth) return createErrorResponse("Unauthorized", 401);
      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: auth } },
      });
      const { data: u } = await userClient.auth.getUser();
      if (!u?.user) return createErrorResponse("Unauthorized", 401);
      if (u.user.user_metadata?.role === "learner") return createErrorResponse("Forbidden", 403);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    const [
      { count: createdWeek },
      { data: decidedWeek },
      { count: aQualifier },
      { count: themesSansReco },
      { count: recosPending },
      { data: cronFailures, error: cronErr },
    ] = await Promise.all([
      (admin as any).from("editorial_recommendations").select("id", { count: "exact", head: true })
        .gte("created_at", weekAgo),
      (admin as any).from("editorial_recommendations")
        .select("status, decision_reason, titre_provisoire")
        .gte("decided_at", weekAgo),
      (admin as any).from("transcripts").select("id", { count: "exact", head: true })
        .eq("status", "ready").not("raw_text", "is", null).is("editorial_qualification", null),
      (admin as any).from("editorial_themes").select("id", { count: "exact", head: true })
        .is("recommendation_id", null),
      (admin as any).from("editorial_recommendations").select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      // Échecs des crons éditoriaux sur 7 jours (détection des pannes silencieuses).
      (admin as any).rpc("editorial_cron_failures_last_week"),
    ]);
    if (cronErr) console.error("[editorial-weekly-digest] cron failures RPC error", cronErr);

    const accepted = (decidedWeek ?? []).filter((d: any) => d.status === "accepted");
    const rejected = (decidedWeek ?? []).filter((d: any) => d.status === "rejected");
    const reasonCounts = new Map<string, number>();
    for (const r of rejected) {
      const key = REASON_LABELS[r.decision_reason] ?? r.decision_reason ?? "sans motif";
      reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
    }
    const topReasons = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([k, v]) => `${k} (${v})`).join(", ");

    const alerts: string[] = [];
    if ((aQualifier ?? 0) > 20) alerts.push(`⚠️ ${aQualifier} transcripts en attente de qualification — le cron editorial-backfill tourne-t-il ?`);
    for (const f of (Array.isArray(cronFailures) ? cronFailures : [])) {
      alerts.push(`⚠️ cron ${f.jobname} : ${f.failed_runs} échec(s) cette semaine — ${String(f.last_error ?? "").slice(0, 120)}`);
    }

    const digest = {
      created_week: createdWeek ?? 0,
      accepted_week: accepted.length,
      rejected_week: rejected.length,
      pending: recosPending ?? 0,
      a_qualifier: aQualifier ?? 0,
      themes_sans_reco: themesSansReco ?? 0,
      top_reject_reasons: topReasons,
      alerts,
    };

    // Canal Slack : "article" par défaut, surchargeable via slack_editorial_channel.
    const { data: chanRow } = await (admin as any)
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "slack_editorial_channel")
      .maybeSingle();
    const channel = chanRow?.setting_value?.trim() || "article";
    const apiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!apiKey) {
      return createJsonResponse({ posted: false, reason: "no_api_key", digest });
    }

    const lines = [
      `*📝 Moteur éditorial — digest hebdo*`,
      `${digest.created_week} recommandation(s) créée(s) · ${digest.accepted_week} acceptée(s) · ${digest.rejected_week} refusée(s) cette semaine`,
      digest.top_reject_reasons ? `Motifs de refus : ${digest.top_reject_reasons}` : "",
      "",
      `File actuelle : *${digest.pending}* à arbitrer · ${digest.themes_sans_reco} thème(s) à analyser · ${digest.a_qualifier} transcript(s) à qualifier`,
      ...alerts,
      "",
      `→ <https://super-tools.lovable.app/transcripts|Ouvrir l'onglet Recommandations dans SuperTools>`,
    ].filter((l) => l !== "").join("\n");

    await fetch(`${GATEWAY_URL}/chat.postMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        channel,
        text: lines,
        username: "SuperTools Éditorial",
        icon_emoji: ":memo:",
      }),
    });

    return createJsonResponse({ posted: true, digest });
  } catch (error) {
    console.error("[editorial-weekly-digest] error", error);
    return createErrorResponse(error instanceof Error ? error.message : "Erreur inconnue", 500, { cause: error, fn: "editorial-weekly-digest" });
  }
});
