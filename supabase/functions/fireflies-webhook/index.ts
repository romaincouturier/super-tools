/**
 * fireflies-webhook
 *
 * Receives POST webhooks from Fireflies.ai when a transcript is ready.
 * Verifies the signing secret, analyzes with Claude, stores in transcripts,
 * notifies Slack, and triggers RAG indexation.
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

interface FirefliesWebhookBody {
  meetingId?: string;
  eventType?: string;
  transcript?: FirefliesTranscript;
}

async function fetchFirefliesTranscript(transcriptId: string): Promise<FirefliesTranscript | null> {
  if (!FIREFLIES_API_KEY) {
    console.error("[fireflies-webhook] FIREFLIES_API_KEY not configured");
    return null;
  }
  const query = `
    query Transcript($id: String!) {
      transcript(id: $id) {
        id
        title
        date
        duration
        summary { overview }
        sentences { speaker_name text }
      }
    }
  `;
  const res = await fetch("https://api.fireflies.ai/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FIREFLIES_API_KEY}`,
    },
    body: JSON.stringify({ query, variables: { id: transcriptId } }),
  });
  if (!res.ok) {
    console.error("[fireflies-webhook] GraphQL fetch failed:", res.status, await res.text());
    return null;
  }
  const json = await res.json();
  if (json.errors) {
    console.error("[fireflies-webhook] GraphQL errors:", JSON.stringify(json.errors));
    return null;
  }
  return json.data?.transcript ?? null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // ── Read config ──────────────────────────────────────────────
    const { data: settingsRows } = await (admin as any)
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["fireflies_webhook_secret", "slack_content_channel"]);

    const get = (k: string) =>
      (settingsRows as Array<{ setting_key: string; setting_value: string }>)
        ?.find((s) => s.setting_key === k)?.setting_value ?? "";

    const storedSecret = get("fireflies_webhook_secret");
    const slackChannel = get("slack_content_channel") || "publications-réso-sociaux";

    // ── Verify signing secret ────────────────────────────────────
    if (storedSecret) {
      const incoming = req.headers.get("X-Webhook-Secret") ?? "";
      if (incoming !== storedSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Parse body ───────────────────────────────────────────────
    const body: FirefliesWebhookBody = await req.json();
    console.log("[fireflies-webhook] payload:", JSON.stringify(body));

    // Resolve transcript: either embedded in payload, or fetched via GraphQL with meetingId
    let t: FirefliesTranscript | null = body.transcript ?? null;
    const transcriptId = t?.id ?? body.meetingId;

    if (!transcriptId) {
      return new Response(JSON.stringify({ ok: true, skipped: "no transcript id in payload" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!t) {
      console.log("[fireflies-webhook] fetching transcript via GraphQL:", transcriptId);
      t = await fetchFirefliesTranscript(transcriptId);
      if (!t) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch transcript from Fireflies API", transcriptId }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ── Idempotency: skip if already imported ────────────────────
    const { data: existing } = await (admin as any)
      .from("transcripts")
      .select("id")
      .eq("source", "fireflies")
      .eq("external_id", t.id)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ ok: true, skipped: "already imported" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Build raw text from sentences ────────────────────────────
    const rawText = t.sentences?.length
      ? t.sentences.map((s) => `${s.speaker_name}: ${s.text}`).join("\n")
      : t.summary?.overview ?? "";

    const analysis = rawText
      ? await analyzeTranscript(rawText)
      : { summary: t.summary?.overview ?? "", tags: [] };

    // ── Insert transcript ────────────────────────────────────────
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
        metadata: {
          fireflies_date: new Date(t.date).toISOString(),
          event_type: body.eventType,
          meeting_id: body.meetingId,
        },
      })
      .select("id")
      .single();

    // ── Notify Slack ─────────────────────────────────────────────
    await notifySlack(
      `🎙️ *Nouveau transcript Fireflies* : ${t.title}\n${analysis.summary}`,
      slackChannel,
    );

    // ── Trigger RAG indexation ───────────────────────────────────
    if (inserted?.id) {
      await fetch(`${SUPABASE_URL}/functions/v1/index-documents`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ source_type: "transcript", source_id: inserted.id }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ ok: true, imported: t.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("fireflies-webhook error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
