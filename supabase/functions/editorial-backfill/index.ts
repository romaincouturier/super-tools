/**
 * editorial-backfill (ST-2026-0226)
 *
 * Qualifie par lots les transcripts "ready" sans fiche éditoriale, en
 * appelant analyze-transcript-editorial en interne pour chacun. Sert au
 * rattrapage de l'historique (162 transcripts au moment du constat) puis de
 * filet permanent : le cron (toutes les 10 min, no-op si rien à faire)
 * ramasse tout transcript dont l'analyse automatique aurait échoué.
 *
 * Body : { limit?: number } (défaut 20, max 40)
 * Auth : x-cron-secret (cron), x-internal-secret (inter-fonctions) ou JWT (UI).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { reportEdgeError } from "../_shared/sentry.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    let body: { limit?: number };
    try { body = await req.json(); } catch { body = {}; }
    const limit = Math.max(1, Math.min(Number(body.limit) || 20, 40));

    // Deux voies internes : service role (appels inter-fonctions) ou secret de
    // cron dédié (EDITORIAL_CRON_SECRET, posé en secret d'edge function et
    // inline dans le SQL du cron — la service_role n'est pas exposable sur
    // Lovable Cloud et le vault du projet est vide).
    const CRON_SECRET = Deno.env.get("EDITORIAL_CRON_SECRET") ?? "";
    const internalSecret = req.headers.get("x-internal-secret");
    const cronSecret = req.headers.get("x-cron-secret");
    const isInternal = (internalSecret && internalSecret === SERVICE_ROLE) ||
      (CRON_SECRET !== "" && cronSecret === CRON_SECRET);
    if (!isInternal) {
      const auth = req.headers.get("Authorization");
      if (!auth) return json({ error: "Unauthorized" }, 401);
      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: auth } },
      });
      const { data: u } = await userClient.auth.getUser();
      if (!u?.user) return json({ error: "Unauthorized" }, 401);
      if (u.user.user_metadata?.role === "learner") return json({ error: "Forbidden" }, 403);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: pending, count } = await (admin as any)
      .from("transcripts")
      .select("id", { count: "exact" })
      .eq("status", "ready")
      .not("raw_text", "is", null)
      .is("editorial_qualification", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!pending?.length) {
      return json({ ok: true, processed: 0, failed: 0, remaining: 0 });
    }

    let processed = 0;
    let failed = 0;
    let rateLimited = false;
    // Séquentiel volontairement : lisse la charge sur le gateway IA.
    for (const t of pending) {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-transcript-editorial`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-secret": SERVICE_ROLE },
        body: JSON.stringify({ transcript_id: t.id }),
      });
      if (res.ok) {
        processed++;
      } else {
        failed++;
        const errText = await res.text();
        console.error(`[editorial-backfill] transcript ${t.id} : ${res.status} ${errText}`);
        // Quota IA atteint : inutile d'insister, le prochain cron reprendra.
        if (res.status === 429 || res.status === 402) { rateLimited = true; break; }
      }
    }

    const remaining = Math.max(0, (count ?? pending.length) - processed);
    return json({ ok: true, processed, failed, remaining, rate_limited: rateLimited });
  } catch (error) {
    await reportEdgeError(error, { fn: "editorial-backfill" });
    console.error("[editorial-backfill] error", error);
    return json({ error: error instanceof Error ? error.message : "Erreur inconnue" }, 500);
  }
});
