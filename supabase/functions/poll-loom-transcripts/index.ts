/**
 * poll-loom-transcripts
 *
 * Cron horaire — liste les vidéos du compte Loom, importe le transcript de
 * celles qui manquent dans `transcripts`, analyse avec Claude (résumé + tags),
 * notifie Slack et déclenche l'indexation RAG.
 *
 * Loom n'a pas d'API publique : l'accès passe par l'API GraphQL interne et le
 * cookie de session `connect.sid` stocké dans app_settings.loom_session_cookie
 * (lisible des seuls admins). Le cookie expire environ tous les 30 jours ;
 * le curseur de polling passe alors en erreur avec le message à afficher.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, createErrorResponse, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { isInternalOrAuthenticated } from "../_shared/cron-auth.ts";
import { isEmptyOrParasiteTranscript, PARASITE_TRANSCRIPT_ERROR } from "../_shared/transcript-quality.ts";
import { analyzeTranscript, notifySlack } from "../_shared/google-drive-helper.ts";
import { getLoomTranscript, listLoomVideos, LoomSessionExpiredError } from "../_shared/loom.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Vidéos listées par passage : borne le temps d'exécution et les appels Claude. */
const LIST_LIMIT = 50;
/** Transcripts importés par passage. Le reste part au tick suivant. */
const IMPORT_LIMIT = 10;
/** Pages parcourues au maximum par passage (LIST_LIMIT vidéos chacune). */
const MAX_PAGES = 20;

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  if (!await isInternalOrAuthenticated(req, "TRANSCRIPTS_CRON_SECRET")) {
    return createErrorResponse("Unauthorized", 401, { fn: "poll-loom-transcripts" });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const setCursor = async (status: "idle" | "error", lastError: string | null) => {
    await (admin as any).from("polling_cursors").update({
      last_synced_at: new Date().toISOString(),
      status,
      last_error: lastError,
    }).eq("source", "loom");
  };

  try {
    const { data: settingsRows } = await (admin as any)
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["loom_session_cookie", "slack_content_channel"]);

    const get = (k: string) =>
      (settingsRows as Array<{ setting_key: string; setting_value: string }>)
        ?.find((s) => s.setting_key === k)?.setting_value ?? "";

    const rawCookie = get("loom_session_cookie").trim();
    const slackChannel = get("slack_content_channel") || "publications-réso-sociaux";

    if (!rawCookie) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "loom_session_cookie not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    // Le réglage accepte le cookie seul ou la paire complète collée du navigateur.
    const cookie = rawCookie.includes("=") ? rawCookie : `connect.sid=${rawCookie}`;

    // Parcourt toute la bibliothèque, puis traite au plus `importLimit` vidéos
    // manquantes. Les vidéos encore sans transcript sont placées en fin de file
    // pour ne pas bloquer les autres à chaque passage.
    let importLimit = IMPORT_LIMIT;
    try {
      const body = await req.clone().json();
      const n = Number(body?.import_limit);
      if (Number.isFinite(n) && n > 0) importLimit = Math.min(Math.floor(n), 25);
    } catch { /* corps vide */ }

    const results = {
      listed: 0, missing_total: 0, imported: 0, without_transcript: 0, errors: 0,
      without_transcript_titles: [] as string[], error_titles: [] as string[],
    };
    const allMissing: Awaited<ReturnType<typeof listLoomVideos>>["videos"] = [];
    let pageCursor: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const { videos, endCursor, hasNextPage } = await listLoomVideos(cookie, LIST_LIMIT, pageCursor);
      results.listed += videos.length;
      if (videos.length > 0) {
        const { data: existing } = await (admin as any)
          .from("transcripts")
          .select("external_id")
          .eq("source", "loom")
          .in("external_id", videos.map((v) => v.id));
        const alreadyImported = new Set(
          ((existing as Array<{ external_id: string }>) ?? []).map((r) => r.external_id),
        );
        allMissing.push(...videos.filter((v) => !alreadyImported.has(v.id)));
      }
      if (!hasNextPage || !endCursor) break;
      pageCursor = endCursor;
    }
    results.missing_total = allMissing.length;
    // Rotation : les plus anciennes d'abord quand body.oldest_first, sinon ordre Loom.
    const missing = allMissing.slice(-importLimit).length && (await req.clone().json().catch(() => ({})))?.oldest_first
      ? allMissing.slice(-importLimit)
      : allMissing.slice(0, importLimit);

    for (const video of missing) {
      try {
        const transcript = await getLoomTranscript(cookie, video.id);
        if (!transcript || transcript.text.trim() === "") {
          // Transcription encore en cours chez Loom, ou vidéo sans parole :
          // rien n'est écrit, la vidéo repassera au tick suivant.
          results.without_transcript++;
          continue;
        }

        const title = video.name || "Loom sans titre";
        const parasite = isEmptyOrParasiteTranscript(transcript.text);
        const analysis = parasite
          ? { summary: "", tags: [] as string[] }
          : await analyzeTranscript(transcript.text);

        const { data: inserted } = await (admin as any)
          .from("transcripts")
          .insert({
            source: "loom",
            external_id: video.id,
            title,
            raw_text: transcript.text,
            summary: analysis.summary,
            tags: analysis.tags,
            duration_seconds: Number.isFinite(Number(video.playable_duration))
              ? Math.round(Number(video.playable_duration))
              : null,
            status: parasite ? "error" : "ready",
            error_message: parasite ? PARASITE_TRANSCRIPT_ERROR : null,
            metadata: {
              loom_url: `https://www.loom.com/share/${video.id}`,
              loom_created_at: video.createdAt,
              language: transcript.language,
            },
          })
          .select("id")
          .single();

        results.imported++;

        if (parasite || !inserted?.id) continue;

        await notifySlack(
          `🎬 *Nouveau transcript Loom* : ${title}\n${analysis.summary}`,
          slackChannel,
        );

        await fetch(`${SUPABASE_URL}/functions/v1/index-documents`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ source_type: "transcript", source_id: inserted.id }),
        }).catch((e) => console.warn("[poll-loom-transcripts] indexation failed", e));

        // Fiche éditoriale IA (fire and forget, comme les autres sources)
        fetch(`${SUPABASE_URL}/functions/v1/analyze-transcript-editorial`, {
          method: "POST",
          headers: {
            "x-internal-secret": SUPABASE_SERVICE_ROLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ transcript_id: inserted.id }),
        }).catch((e) => console.warn("[poll-loom-transcripts] editorial analysis failed", e));
      } catch (e) {
        if (e instanceof LoomSessionExpiredError) throw e;
        results.errors++;
        console.error(`[poll-loom-transcripts] vidéo ${video.id} échouée`, e);
      }
    }

    await setCursor("idle", null);
    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await setCursor("error", message);
    return createErrorResponse(message, 500, { cause: e, fn: "poll-loom-transcripts" });
  }
});
