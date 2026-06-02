/**
 * fireflies-backfill-range
 *
 * One-shot backfill: pages backward through Fireflies transcripts using
 * toDate cursor between [fromDate, toDate]. Idempotent — dedupes on
 * (source='fireflies', external_id). Imports raw text + summary via Claude.
 *
 * POST body: { fromDate?: ISOString, toDate?: ISOString, maxPages?: number }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { analyzeTranscript } from "../_shared/google-drive-helper.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREFLIES_API_KEY = Deno.env.get("FIREFLIES_API_KEY") ?? "";

interface FF {
  id: string;
  title: string;
  date: number;
  duration: number;
  summary?: { overview?: string };
  sentences?: Array<{ speaker_name: string; text: string }>;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  if (!FIREFLIES_API_KEY) {
    return new Response(JSON.stringify({ error: "FIREFLIES_API_KEY missing" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const body = await req.json().catch(() => ({}));
  const fromDate: string = body.fromDate ?? "2025-01-01T00:00:00Z";
  let toDate: string = body.toDate ?? new Date().toISOString();
  const maxPages: number = Math.min(body.maxPages ?? 30, 50);
  const limit = 25;

  const totals = { pages: 0, fetched: 0, imported: 0, skipped: 0, errors: 0, rate_limited: false };
  const log: any[] = [];

  for (let page = 0; page < maxPages; page++) {
    const query = `query($fromDate: DateTime, $toDate: DateTime, $limit: Int) {
      transcripts(fromDate: $fromDate, toDate: $toDate, limit: $limit) {
        id title date duration
        summary { overview }
        sentences { speaker_name text }
      }
    }`;

    const r = await fetch("https://api.fireflies.ai/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIREFLIES_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { fromDate, toDate, limit } }),
    });

    if (r.status === 429) {
      totals.rate_limited = true;
      log.push({ page, rate_limited: true, retry_after: r.headers.get("retry-after") });
      break;
    }

    const j = await r.json();
    if (j.errors?.length) {
      log.push({ page, error: j.errors });
      totals.errors++;
      break;
    }

    const list: FF[] = j.data?.transcripts ?? [];
    totals.pages++;
    totals.fetched += list.length;
    if (!list.length) break;

    // Sorted DESC by date; oldest in batch:
    let oldest = Number.POSITIVE_INFINITY;
    for (const t of list) {
      if (t.date < oldest) oldest = t.date;

      const { data: existing } = await (admin as any)
        .from("transcripts").select("id")
        .eq("source", "fireflies").eq("external_id", t.id).maybeSingle();
      if (existing) { totals.skipped++; continue; }

      const rawText = t.sentences?.length
        ? t.sentences.map((s) => `${s.speaker_name}: ${s.text}`).join("\n")
        : t.summary?.overview ?? "";

      try {
        const analysis = rawText
          ? await analyzeTranscript(rawText)
          : { summary: t.summary?.overview ?? "", tags: [] };

        const { error: insErr } = await (admin as any).from("transcripts").insert({
          source: "fireflies",
          external_id: t.id,
          title: t.title,
          raw_text: rawText,
          summary: analysis.summary || t.summary?.overview,
          tags: analysis.tags,
          duration_seconds: Number.isFinite(Number(t.duration))
            ? Math.round(Number(t.duration) * 60) : null,
          status: rawText && rawText.length < 10 ? "trashed" : "ready",
          metadata: { fireflies_date: new Date(t.date).toISOString(), backfill: true },
        });
        if (insErr) throw new Error(insErr.message);
        totals.imported++;
      } catch (e) {
        totals.errors++;
        log.push({ id: t.id, error: e instanceof Error ? e.message : String(e) });
      }
    }

    // Advance toDate to just before oldest item in this batch
    if (!Number.isFinite(oldest)) break;
    const nextTo = new Date(oldest - 1000).toISOString();
    if (nextTo <= fromDate) break;
    toDate = nextTo;

    // Stop if batch smaller than limit (no more available before this point)
    if (list.length < limit) break;
  }

  return new Response(JSON.stringify({ ok: true, totals, finalToDate: toDate, log }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
