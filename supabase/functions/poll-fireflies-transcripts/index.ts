/**
 * poll-fireflies-transcripts
 *
 * Cron function — imports new transcripts from Fireflies.ai GraphQL API
 * since the last sync, analyzes them with Claude (summary + tags),
 * stores in the transcripts table, and notifies Slack.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { analyzeTranscript, notifySlack } from "../_shared/google-drive-helper.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREFLIES_API_KEY = Deno.env.get("FIREFLIES_API_KEY") ?? "";

interface FirefliesTranscript {
  id: string;
  title: string;
  date: number; // epoch ms
  duration: number; // seconds
  summary?: { overview?: string };
  sentences?: Array<{ speaker_name: string; text: string }>;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // ── Read config ──────────────────────────────────────────────
    const { data: settingsRows } = await (admin as any)
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["fireflies_api_key", "slack_content_channel"]);

    const get = (k: string) =>
      (settingsRows as Array<{ setting_key: string; setting_value: string }>)
        ?.find((s) => s.setting_key === k)?.setting_value ?? "";

    const apiKey = FIREFLIES_API_KEY || get("fireflies_api_key");
    const slackChannel = get("slack_content_channel") || "publications-réso-sociaux";

    if (!apiKey) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "FIREFLIES_API_KEY not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Get cursor ───────────────────────────────────────────────
    const { data: cursorRow } = await (admin as any)
      .from("polling_cursors")
      .select("last_synced_at")
      .eq("source", "fireflies")
      .single();

    const lastSyncedAt = (cursorRow as { last_synced_at?: string } | null)?.last_synced_at;
    const dateFrom = lastSyncedAt
      ? new Date(lastSyncedAt).toISOString().split("T")[0]
      : new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split("T")[0]; // 30d default

    // ── Query Fireflies GraphQL ──────────────────────────────────
    const query = `
      query($dateFrom: String) {
        transcripts(date_from: $dateFrom, limit: 20) {
          id
          title
          date
          duration
          summary { overview }
          sentences { speaker_name text }
        }
      }
    `;

    const ffRes = await fetch("https://api.fireflies.ai/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables: { dateFrom } }),
    });

    if (!ffRes.ok) {
      throw new Error(`Fireflies API error: ${ffRes.status} ${await ffRes.text()}`);
    }

    const ffData = await ffRes.json();
    if (ffData.errors?.length) {
      throw new Error(`Fireflies GraphQL error: ${JSON.stringify(ffData.errors)}`);
    }

    const transcripts: FirefliesTranscript[] = ffData.data?.transcripts ?? [];

    const results = { imported: 0, skipped: 0, errors: 0 };

    for (const t of transcripts) {
      // Check if already imported
      const { data: existing } = await (admin as any)
        .from("transcripts")
        .select("id")
        .eq("source", "fireflies")
        .eq("external_id", t.id)
        .maybeSingle();

      if (existing) { results.skipped++; continue; }

      // Build raw text from sentences
      const rawText = t.sentences?.length
        ? t.sentences.map((s) => `${s.speaker_name}: ${s.text}`).join("\n")
        : t.summary?.overview ?? "";

      try {
        const analysis = rawText
          ? await analyzeTranscript(rawText)
          : { summary: t.summary?.overview ?? "", tags: [] };

        const { data: inserted } = await (admin as any)
          .from("transcripts")
          .insert({
            source: "fireflies",
            external_id: t.id,
            title: t.title,
            raw_text: rawText,
            summary: analysis.summary || t.summary?.overview,
            tags: analysis.tags,
            duration_seconds: t.duration,
            status: "ready",
            metadata: { fireflies_date: new Date(t.date).toISOString() },
          })
          .select("id")
          .single();

        results.imported++;

        await notifySlack(
          `🎙️ *Nouveau transcript Fireflies* : ${t.title}\n${analysis.summary}`,
          slackChannel,
        );

        // Trigger RAG indexation
        if (inserted?.id) {
          await fetch(`${SUPABASE_URL}/functions/v1/index-documents`, {
            method: "POST",
            headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ source_type: "transcript", source_id: inserted.id }),
          }).catch(() => {});
        }
      } catch (err) {
        console.error(`Failed to import Fireflies transcript ${t.id}:`, err);
        results.errors++;
      }
    }

    await (admin as any).from("polling_cursors").update({
      last_synced_at: new Date().toISOString(),
      status: "idle",
      last_error: null,
    }).eq("source", "fireflies");

    return new Response(JSON.stringify({ ok: true, ...results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("poll-fireflies-transcripts error:", message);
    await (admin as any).from("polling_cursors")
      .update({ status: "error", last_error: message })
      .eq("source", "fireflies");
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
