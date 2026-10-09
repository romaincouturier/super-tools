/**
 * Kanban éditorial et newsletters exposés au connecteur MCP.
 *
 * Lecture légère (list_content_board, list_newsletters, get_content_card) et
 * deux écritures : create_content_card (additive) et prepare_newsletter, qui
 * ne remplace que le sommaire d'un brouillon et refuse toute newsletter envoyée.
 * Aucun envoi n'est possible d'ici.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

type Supabase = SupabaseClient;
type Row = Record<string, unknown>;

export const CARD_TYPES = ["article", "post", "post_linkedin"] as const;
const DEFAULT_COLUMN = "Idées";
const TITLE_MAX = 300;
const BODY_MAX = 200_000;

/** `tags` est un jsonb qui contient soit un tableau, soit (héritage) un tableau sérialisé en chaîne. */
export function normalizeTags(raw: unknown): string[] {
  let v = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return v.trim() ? [v.trim()] : [];
    }
  }
  return Array.isArray(v) ? v.filter((t): t is string => typeof t === "string" && t.trim() !== "").map((t) => t.trim()) : [];
}

function norm(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function resolveColumn<T extends { id: string; name: string }>(columns: T[], name?: string | null): T {
  const wanted = norm(name || DEFAULT_COLUMN);
  const hit = columns.find((c) => norm(c.name) === wanted);
  if (!hit) {
    throw new Error(`Unknown column "${name}". Valid columns: ${columns.map((c) => c.name).join(", ")}`);
  }
  return hit;
}

export function cleanTags(tags: unknown): string[] {
  if (tags === undefined || tags === null) return [];
  if (!Array.isArray(tags)) throw new Error("tags must be an array of strings");
  return [...new Set(tags.filter((t) => typeof t === "string").map((t) => (t as string).trim()).filter(Boolean))].slice(0, 10);
}

async function loadColumns(supabase: Supabase): Promise<Array<{ id: string; name: string; display_order: number }>> {
  const { data, error } = await supabase.from("content_columns").select("id, name, display_order").order("display_order");
  if (error) throw new Error(error.message);
  return (data || []) as Array<{ id: string; name: string; display_order: number }>;
}

export interface NewCardInput {
  title?: unknown;
  content?: unknown;
  tags?: unknown;
  column?: unknown;
  card_type?: unknown;
  emoji?: unknown;
  deadline?: unknown;
}

export function validateNewCard(input: NewCardInput) {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) throw new Error("title is required");
  if (title.length > TITLE_MAX) throw new Error(`title is limited to ${TITLE_MAX} characters`);
  const content = typeof input.content === "string" ? input.content : "";
  if (content.length > BODY_MAX) throw new Error(`content is limited to ${BODY_MAX} characters`);
  const cardType = (input.card_type as string) || "article";
  if (!(CARD_TYPES as readonly string[]).includes(cardType)) {
    throw new Error(`card_type must be one of: ${CARD_TYPES.join(", ")}`);
  }
  const deadline = input.deadline ? String(input.deadline) : null;
  if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) throw new Error("deadline must be YYYY-MM-DD");
  return {
    title,
    content,
    tags: cleanTags(input.tags),
    column: typeof input.column === "string" ? input.column : null,
    card_type: cardType,
    emoji: typeof input.emoji === "string" && input.emoji.trim() ? input.emoji.trim().slice(0, 8) : null,
    deadline,
  };
}

async function insertCard(
  supabase: Supabase,
  columns: Array<{ id: string; name: string }>,
  input: NewCardInput,
) {
  const v = validateNewCard(input);
  const col = resolveColumn(columns, v.column);
  const { data: first } = await supabase
    .from("content_cards")
    .select("display_order")
    .eq("column_id", col.id)
    .order("display_order", { ascending: true })
    .limit(1);
  const order = ((first?.[0] as Row | undefined)?.display_order as number | undefined ?? 1) - 1;
  const { data, error } = await supabase
    .from("content_cards")
    .insert({
      title: v.title,
      description: v.content,
      tags: v.tags,
      column_id: col.id,
      display_order: order,
      card_type: v.card_type,
      emoji: v.emoji,
      deadline: v.deadline,
    })
    .select("id, title")
    .single();
  if (error) throw new Error(error.message);
  return { id: (data as Row).id as string, title: v.title, column: col.name, tags: v.tags };
}

export async function createContentCard(supabase: Supabase, input: NewCardInput) {
  const columns = await loadColumns(supabase);
  const card = await insertCard(supabase, columns, input);
  return { created: true, card };
}

/** Dernière newsletter (envoyée ou non) dans laquelle chaque carte apparaît. */
async function newsletterUsage(supabase: Supabase, cardIds: string[]) {
  const usage = new Map<string, { sent: string[]; planned: string[] }>();
  if (!cardIds.length) return usage;
  const { data, error } = await supabase
    .from("newsletter_cards")
    .select("card_id, newsletters(scheduled_date, status, sent_at)")
    .in("card_id", cardIds);
  if (error) throw new Error(error.message);
  for (const r of (data || []) as Row[]) {
    const n = r.newsletters as Row | null;
    if (!n) continue;
    const id = r.card_id as string;
    const u = usage.get(id) ?? { sent: [], planned: [] };
    const date = ((n.sent_at as string | null)?.slice(0, 10)) || (n.scheduled_date as string);
    (n.status === "sent" ? u.sent : u.planned).push(date);
    usage.set(id, u);
  }
  return usage;
}

export async function listContentBoard(
  supabase: Supabase,
  opts: { column?: string; tag?: string; search?: string; limit?: number },
) {
  const columns = await loadColumns(supabase);
  let q = supabase
    .from("content_cards")
    .select("id, title, tags, card_type, emoji, deadline, column_id, display_order, updated_at")
    .order("display_order");
  if (opts.column) q = q.eq("column_id", resolveColumn(columns, opts.column).id);
  if (opts.search) q = q.ilike("title", `%${opts.search.replace(/[%_]/g, "")}%`);
  const { data, error } = await q.limit(1000);
  if (error) throw new Error(error.message);
  const colName = new Map(columns.map((c) => [c.id, c.name]));
  const colOrder = new Map(columns.map((c) => [c.id, c.display_order]));
  const wantedTag = opts.tag ? norm(opts.tag) : null;
  let cards = ((data || []) as Row[])
    .map((c) => ({ ...c, tags: normalizeTags(c.tags) }))
    .filter((c) => !wantedTag || c.tags.some((t) => norm(t) === wantedTag))
    .sort((a, b) =>
      (colOrder.get(a.column_id as string) ?? 0) - (colOrder.get(b.column_id as string) ?? 0) ||
      (a.display_order as number) - (b.display_order as number)
    );
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 500);
  const total = cards.length;
  cards = cards.slice(0, limit);
  const usage = await newsletterUsage(supabase, cards.map((c) => c.id as string));
  return {
    columns: columns.map((c) => c.name),
    total,
    truncated: total > cards.length,
    cards: cards.map((c) => {
      const u = usage.get(c.id as string);
      return {
        id: c.id,
        title: c.title,
        column: colName.get(c.column_id as string) ?? null,
        tags: c.tags,
        card_type: c.card_type,
        emoji: c.emoji ?? null,
        deadline: c.deadline ?? null,
        last_sent_newsletter: u?.sent.sort().at(-1) ?? null,
        in_draft_newsletter: (u?.planned.length ?? 0) > 0,
      };
    }),
  };
}

export async function getContentCard(supabase: Supabase, cardId: string) {
  if (!cardId) throw new Error("card_id is required");
  const { data, error } = await supabase
    .from("content_cards")
    .select("id, title, description, tags, card_type, emoji, deadline, created_at, updated_at, content_columns(name)")
    .eq("id", cardId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("card not found");
  const c = data as Row;
  const usage = (await newsletterUsage(supabase, [cardId])).get(cardId);
  return {
    id: c.id,
    title: c.title,
    column: (c.content_columns as Row | null)?.name ?? null,
    tags: normalizeTags(c.tags),
    card_type: c.card_type,
    emoji: c.emoji ?? null,
    deadline: c.deadline ?? null,
    content: c.description ?? "",
    created_at: c.created_at,
    updated_at: c.updated_at,
    sent_in_newsletters: usage?.sent.sort() ?? [],
  };
}

export async function listNewsletters(supabase: Supabase, opts: { limit?: number; status?: string }) {
  const limit = Math.min(Math.max(opts.limit ?? 12, 1), 50);
  let q = supabase
    .from("newsletters")
    .select("id, title, scheduled_date, status, sent_at")
    .order("scheduled_date", { ascending: false })
    .limit(limit);
  if (opts.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const letters = (data || []) as Row[];
  const ids = letters.map((n) => n.id as string);
  const { data: links, error: e2 } = ids.length
    ? await supabase
      .from("newsletter_cards")
      .select("newsletter_id, display_order, content_cards(id, title, tags, card_type)")
      .in("newsletter_id", ids)
      .order("display_order")
    : { data: [], error: null };
  if (e2) throw new Error(e2.message);
  const byLetter = new Map<string, Row[]>();
  for (const l of (links || []) as Row[]) {
    const c = l.content_cards as Row | null;
    if (!c) continue;
    const arr = byLetter.get(l.newsletter_id as string) ?? [];
    arr.push({ id: c.id, title: c.title, tags: normalizeTags(c.tags), card_type: c.card_type });
    byLetter.set(l.newsletter_id as string, arr);
  }
  return {
    newsletters: letters.map((n) => ({
      id: n.id,
      title: n.title,
      scheduled_date: n.scheduled_date,
      status: n.status,
      sent_at: n.sent_at,
      articles: byLetter.get(n.id as string) ?? [],
    })),
  };
}

export type TocItem = { card_id?: unknown } & NewCardInput;

export interface PrepareNewsletterInput {
  newsletter_id?: unknown;
  title?: unknown;
  scheduled_date?: unknown;
  items?: unknown;
}

/** Valide le sommaire sans toucher la base : chaque entrée est une carte existante OU un nouveau contenu. */
export function validateToc(items: unknown): TocItem[] {
  if (!Array.isArray(items) || items.length === 0) throw new Error("items must be a non-empty array");
  if (items.length > 30) throw new Error("items is limited to 30 entries");
  const seen = new Set<string>();
  return items.map((raw, i) => {
    const it = (raw ?? {}) as TocItem;
    if (it.card_id) {
      const id = String(it.card_id);
      if (seen.has(id)) throw new Error(`items[${i}]: card ${id} appears twice`);
      seen.add(id);
      return { card_id: id };
    }
    try {
      validateNewCard(it);
    } catch (e) {
      throw new Error(`items[${i}]: ${e instanceof Error ? e.message : e} (give either card_id or a new card with a title)`);
    }
    return it;
  });
}

export async function prepareNewsletter(supabase: Supabase, input: PrepareNewsletterInput) {
  const toc = validateToc(input.items);

  let letter: Row | null = null;
  if (input.newsletter_id) {
    const { data, error } = await supabase
      .from("newsletters").select("id, title, scheduled_date, status").eq("id", String(input.newsletter_id)).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("newsletter not found");
    letter = data as Row;
    if (letter.status === "sent") throw new Error("This newsletter has already been sent: its table of contents cannot be changed");
  } else {
    const date = input.scheduled_date ? String(input.scheduled_date) : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("scheduled_date (YYYY-MM-DD) is required to create a new draft, or pass newsletter_id");
    const { data, error } = await supabase
      .from("newsletters")
      .insert({ title: typeof input.title === "string" && input.title.trim() ? input.title.trim() : null, scheduled_date: date, status: "draft" })
      .select("id, title, scheduled_date, status")
      .single();
    if (error) throw new Error(error.message);
    letter = data as Row;
  }

  const existingIds = toc.filter((t) => t.card_id).map((t) => t.card_id as string);
  if (existingIds.length) {
    const { data, error } = await supabase.from("content_cards").select("id").in("id", existingIds);
    if (error) throw new Error(error.message);
    const found = new Set(((data || []) as Row[]).map((r) => r.id as string));
    const missing = existingIds.filter((id) => !found.has(id));
    if (missing.length) throw new Error(`Unknown card_id: ${missing.join(", ")}`);
  }

  const columns = await loadColumns(supabase);
  const created: Array<{ id: string; title: string; column: string }> = [];
  const orderedIds: string[] = [];
  for (const t of toc) {
    if (t.card_id) orderedIds.push(t.card_id as string);
    else {
      const c = await insertCard(supabase, columns, t);
      created.push({ id: c.id, title: c.title, column: c.column });
      orderedIds.push(c.id);
    }
  }

  const letterId = letter.id as string;
  const { error: delErr } = await supabase.from("newsletter_cards").delete().eq("newsletter_id", letterId);
  if (delErr) throw new Error(delErr.message);
  const { error: insErr } = await supabase
    .from("newsletter_cards")
    .insert(orderedIds.map((card_id, display_order) => ({ newsletter_id: letterId, card_id, display_order })));
  if (insErr) throw new Error(insErr.message);

  const usage = await newsletterUsage(supabase, orderedIds);
  const { data: titles } = await supabase.from("content_cards").select("id, title").in("id", orderedIds);
  const titleOf = new Map(((titles || []) as Row[]).map((r) => [r.id as string, r.title as string]));
  return {
    newsletter: { id: letterId, title: letter.title, scheduled_date: letter.scheduled_date, status: letter.status },
    table_of_contents: orderedIds.map((id, i) => ({
      position: i + 1,
      card_id: id,
      title: titleOf.get(id) ?? null,
      already_sent_in: usage.get(id)?.sent.sort() ?? [],
    })),
    created_cards: created,
    note: "Draft only: sending stays manual in SuperTools.",
  };
}
