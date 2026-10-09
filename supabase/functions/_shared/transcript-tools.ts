/**
 * Transcripts exposés au connecteur MCP : rafraîchissement des sources,
 * liste des transcripts non affectés, association / dissociation à une
 * opportunité CRM ou à une mission.
 *
 * Mêmes règles que l'interface : une opportunité est liée via
 * crm_card_transcripts ; une mission via une page créée depuis le transcript
 * (mission_pages.source_transcript_id). La dissociation d'une mission
 * conserve la page et ne retire que le lien.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

type Supabase = SupabaseClient;
type Assignment = { transcript_id: string; kind: string; entity_id: string; label: string };

export const TRANSCRIPT_TARGETS = ["opportunity", "mission"] as const;
export type TranscriptTarget = typeof TRANSCRIPT_TARGETS[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireUuid(v: unknown, field: string): string {
  if (typeof v !== "string" || !UUID.test(v)) throw new Error(`${field} must be a UUID`);
  return v;
}

function requireTarget(v: unknown): TranscriptTarget {
  if (!TRANSCRIPT_TARGETS.includes(v as TranscriptTarget)) {
    throw new Error(`target_type must be one of: ${TRANSCRIPT_TARGETS.join(", ")}`);
  }
  return v as TranscriptTarget;
}

async function loadAssignments(supabase: Supabase): Promise<Map<string, Assignment[]>> {
  const { data, error } = await supabase.rpc("get_transcript_assignments");
  if (error) throw new Error(error.message);
  const map = new Map<string, Assignment[]>();
  for (const row of (data || []) as Assignment[]) {
    const list = map.get(row.transcript_id) ?? [];
    list.push(row);
    map.set(row.transcript_id, list);
  }
  return map;
}

function transcriptDate(t: { metadata?: unknown; created_at: string }): string {
  const m = (t.metadata ?? {}) as Record<string, unknown>;
  return String(m.fireflies_date ?? m.file_date ?? t.created_at);
}

export async function listUnassignedTranscripts(
  supabase: Supabase,
  opts: { limit?: number; search?: string; since?: string; include_assigned?: boolean },
) {
  const limit = Math.min(Math.max(Number(opts.limit) || 30, 1), 100);
  let q = supabase
    .from("transcripts")
    .select("id, title, ai_title, summary, source, status, created_at, metadata")
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(500);
  if (opts.since) q = q.gte("created_at", opts.since);
  if (opts.search?.trim()) {
    const s = opts.search.trim().replace(/[%,()]/g, " ");
    q = q.or(`title.ilike.%${s}%,ai_title.ilike.%${s}%,summary.ilike.%${s}%`);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const assignments = await loadAssignments(supabase);
  const rows = (data || [])
    .map((t) => ({ t, a: assignments.get(t.id as string) ?? [] }))
    .filter(({ a }) => opts.include_assigned || a.length === 0)
    .slice(0, limit);
  return {
    count: rows.length,
    transcripts: rows.map(({ t, a }) => ({
      id: t.id,
      title: t.ai_title || t.title || "Transcript",
      date: transcriptDate(t as { metadata?: unknown; created_at: string }),
      source: t.source,
      summary: typeof t.summary === "string" ? t.summary.slice(0, 600) : null,
      assignments: a.map(({ kind, entity_id, label }) => ({ kind, entity_id, label })),
    })),
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function paragraphs(text: string): string[] {
  return text.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`);
}

/** Même rendu que la page créée depuis l'interface (MissionTranscriptPagePicker). */
export function transcriptToPageHtml(t: { summary?: string | null; raw_text?: string | null }): string {
  const parts: string[] = [];
  if (t.summary) parts.push("<h2>Résumé</h2>", ...paragraphs(t.summary));
  if (t.raw_text) parts.push("<h2>Transcript</h2>", ...paragraphs(t.raw_text));
  return parts.join("\n");
}

export async function assignTranscript(
  supabase: Supabase,
  args: { transcript_id?: unknown; target_type?: unknown; target_id?: unknown; allow_multiple?: unknown },
) {
  const transcriptId = requireUuid(args.transcript_id, "transcript_id");
  const target = requireTarget(args.target_type);
  const targetId = requireUuid(args.target_id, "target_id");

  const { data: t, error: tErr } = await supabase
    .from("transcripts")
    .select("id, title, ai_title, summary, raw_text, status")
    .eq("id", transcriptId)
    .maybeSingle();
  if (tErr) throw new Error(tErr.message);
  if (!t) throw new Error("Transcript not found");
  if (t.status !== "ready") throw new Error(`Transcript is not ready (status: ${t.status})`);

  const existing = (await loadAssignments(supabase)).get(transcriptId) ?? [];
  const kind = target === "opportunity" ? "opportunity" : "mission";
  if (existing.some((a) => a.kind === kind && a.entity_id === targetId)) {
    return { status: "already_assigned", transcript_id: transcriptId, target_type: target, target_id: targetId };
  }
  const elsewhere = existing.map(({ kind, entity_id, label }) => ({ kind, entity_id, label }));
  if (elsewhere.length && args.allow_multiple !== true) {
    return {
      status: "needs_confirmation",
      message: "This transcript is already assigned elsewhere. Ask the user, then call again with allow_multiple=true, or unassign it first.",
      current_assignments: elsewhere,
    };
  }

  const title = (t.ai_title || t.title || "Transcript") as string;
  if (target === "opportunity") {
    const { data: card, error: cErr } = await supabase.from("crm_cards").select("id, title, company").eq("id", targetId).maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!card) throw new Error("Opportunity not found");
    const { error } = await supabase
      .from("crm_card_transcripts")
      .upsert({ card_id: targetId, transcript_id: transcriptId }, { onConflict: "card_id,transcript_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    return { status: "assigned", transcript: title, opportunity: card, previous_assignments: elsewhere };
  }

  const { data: mission, error: mErr } = await supabase.from("missions").select("id, title, client_name").eq("id", targetId).maybeSingle();
  if (mErr) throw new Error(mErr.message);
  if (!mission) throw new Error("Mission not found");
  const { data: last } = await supabase
    .from("mission_pages")
    .select("position")
    .eq("mission_id", targetId)
    .is("parent_page_id", null)
    .order("position", { ascending: false })
    .limit(1);
  const position = ((last?.[0]?.position as number | undefined) ?? -1) + 1;
  const { data: page, error } = await supabase
    .from("mission_pages")
    .insert({
      mission_id: targetId,
      parent_page_id: null,
      title,
      content: transcriptToPageHtml(t as { summary?: string | null; raw_text?: string | null }),
      icon: "🎙️",
      position,
      source_transcript_id: transcriptId,
    })
    .select("id, title")
    .single();
  if (error) throw new Error(error.message);
  return { status: "assigned", transcript: title, mission, page_created: page, previous_assignments: elsewhere };
}

export async function unassignTranscript(
  supabase: Supabase,
  args: { transcript_id?: unknown; target_type?: unknown; target_id?: unknown },
) {
  const transcriptId = requireUuid(args.transcript_id, "transcript_id");
  const target = requireTarget(args.target_type);
  const targetId = requireUuid(args.target_id, "target_id");
  const res = target === "opportunity"
    ? await supabase.from("crm_card_transcripts").delete().eq("card_id", targetId).eq("transcript_id", transcriptId).select("id")
    : await supabase.from("mission_pages").update({ source_transcript_id: null }).eq("mission_id", targetId).eq("source_transcript_id", transcriptId).select("id");
  if (res.error) throw new Error(res.error.message);
  const n = res.data?.length ?? 0;
  return {
    status: n ? "unassigned" : "not_assigned",
    links_removed: n,
    note: target === "mission" && n ? "The mission page is kept; only its link to the transcript was removed." : undefined,
  };
}

export const REFRESH_SOURCES = { google_drive: "poll-drive-transcripts", fireflies: "fireflies-backfill" } as const;

export async function refreshTranscripts(
  args: { source?: unknown },
  invoke: (fn: string) => Promise<unknown>,
) {
  const src = (args.source ?? "all") as string;
  const keys = src === "all" ? Object.keys(REFRESH_SOURCES) : [src];
  for (const k of keys) {
    if (!(k in REFRESH_SOURCES)) throw new Error(`source must be google_drive, fireflies or all`);
  }
  const results: Record<string, unknown> = {};
  for (const k of keys) {
    try {
      results[k] = { ok: true, result: await invoke(REFRESH_SOURCES[k as keyof typeof REFRESH_SOURCES]) };
    } catch (e) {
      results[k] = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
  return {
    results,
    note: "Drive audio files are transcribed asynchronously: new transcripts may take a few minutes to appear in list_unassigned_transcripts.",
  };
}
