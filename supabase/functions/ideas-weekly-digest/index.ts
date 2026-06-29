import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
} from "../_shared/cors.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";
import { reportEdgeError } from "../_shared/sentry.ts";

/**
 * Digest hebdo de la boîte à idées (lot 4).
 * Construit le top des idées (par votes) + les nouvelles de la semaine, et
 * le poste sur Slack si un canal est configuré (setting `slack_ideas_channel`,
 * repli `slack_crm_channel`). Sinon, renvoie simplement le digest en JSON.
 * À planifier en cron hebdomadaire (verify_jwt=false).
 */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";

interface IdeaLite {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    const supabase = getSupabaseClient();
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    const [{ data: ideasData }, { data: votesData }] = await Promise.all([
      supabase.from("ideas").select("id, title, status, created_at").neq("status", "rejetee"),
      supabase.from("idea_votes").select("idea_id"),
    ]);

    const ideas = (ideasData ?? []) as IdeaLite[];
    const voteCount = new Map<string, number>();
    for (const v of (votesData ?? []) as { idea_id: string }[]) {
      voteCount.set(v.idea_id, (voteCount.get(v.idea_id) ?? 0) + 1);
    }

    const top = [...ideas]
      .sort((a, b) => (voteCount.get(b.id) ?? 0) - (voteCount.get(a.id) ?? 0))
      .slice(0, 5)
      .map((i) => ({ title: i.title, votes: voteCount.get(i.id) ?? 0 }));

    const fresh = ideas.filter((i) => i.created_at >= weekAgo);
    const toTriage = ideas.filter((i) => i.status === "nouvelle").length;

    const digest = { top, new_this_week: fresh.length, to_triage: toTriage };

    // Résolution du canal
    const { data: chanRow } = await supabase
      .from("app_settings")
      .select("setting_value")
      .in("setting_key", ["slack_ideas_channel", "slack_crm_channel"]);
    const channel = (chanRow ?? [])
      .map((r: { setting_value: string | null }) => r.setting_value)
      .find((v) => v && v.trim());
    const apiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!channel || !apiKey) {
      return createJsonResponse({ posted: false, reason: "no_channel_or_key", digest });
    }

    const lines = [
      `*💡 Boîte à idées — digest hebdo*`,
      `${fresh.length} nouvelle(s) cette semaine · ${toTriage} à trier`,
      "",
      ...(top.length ? ["*Top idées (votes)*", ...top.map((t, i) => `${i + 1}. ${t.title} — ${t.votes} 👍`)] : ["Aucune idée pour le moment."]),
    ].join("\n");

    await fetch(`${GATEWAY_URL}/chat.postMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        channel,
        text: lines,
        username: "SuperTools Idées",
        icon_emoji: ":bulb:",
      }),
    });

    return createJsonResponse({ posted: true, digest });
  } catch (err) {
    console.error("[ideas-weekly-digest] error", err);
    await reportEdgeError(err, { fn: "ideas-weekly-digest" });
    return createErrorResponse(err instanceof Error ? err.message : "Erreur inconnue", 500);
  }
});
