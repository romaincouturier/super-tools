import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Tables absentes des types générés tant que Lovable ne les a pas régénérés
// (règle [079]) : client non typé, types locaux.
const db = supabase as unknown as SupabaseClient;

export type SocialFormat = "post" | "story" | "reel";
export type SocialPublicationStatus = "unscheduled" | "scheduled" | "published";

export const SOCIAL_FORMAT_LABELS: Record<SocialFormat, string> = {
  post: "Post",
  story: "Story",
  reel: "Reel",
};

export const NO_CHANNEL_MESSAGE = "Choisissez au moins un canal";

export interface SocialChannel {
  id: string;
  slug: string;
  name: string;
  abbreviation: string;
  text_limit: number | null;
  sort_order: number;
  is_active: boolean;
}

export interface SocialPost {
  id: string;
  group_id: string;
  channel_id: string;
  text: string;
  scheduled_at: string | null;
  publication_status: SocialPublicationStatus;
}

export interface SocialContentGroup {
  id: string;
  format: SocialFormat;
  sync: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  posts: SocialPost[];
}

/** État du composeur, tel qu'il est enregistré. */
export interface SocialGroupDraft {
  groupId: string;
  format: SocialFormat;
  sync: boolean;
  channelIds: string[];
  /** Texte commun, utilisé tant que la synchro est active. */
  commonText: string;
  /** Texte propre à chaque canal, utilisé quand la synchro est coupée. */
  texts: Record<string, string>;
  scheduledAt: string | null;
}

export interface SocialPostInput {
  channel_id: string;
  text: string;
  scheduled_at: string | null;
}

/** Un post par canal coché : texte commun si synchro, texte propre sinon. */
export function buildGroupPosts(draft: Omit<SocialGroupDraft, "groupId" | "format">): SocialPostInput[] {
  return [...new Set(draft.channelIds)].map((channel_id) => ({
    channel_id,
    text: draft.sync ? draft.commonText : (draft.texts[channel_id] ?? draft.commonText),
    scheduled_at: draft.scheduledAt,
  }));
}

const PARIS = "Europe/Paris";

function parisOffsetMs(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PARIS, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return wall - utcMs;
}

/** Jour "YYYY-MM-DD" et heure "HH:MM" à Paris -> instant ISO UTC. */
export function parisLocalToUtcIso(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, h, min);
  const first = wall - parisOffsetMs(wall);
  return new Date(wall - parisOffsetMs(first)).toISOString();
}

/** Instant ISO -> jour et heure à Paris. */
export function utcIsoToParisLocal(iso: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

export async function listChannels(): Promise<SocialChannel[]> {
  const { data, error } = await db
    .from("social_channels")
    .select("id, slug, name, abbreviation, text_limit, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as SocialChannel[];
}

export async function getGroup(id: string): Promise<SocialContentGroup | null> {
  const { data, error } = await db
    .from("social_content_groups")
    .select("id, format, sync, created_by, created_at, updated_at, posts:social_posts(id, group_id, channel_id, text, scheduled_at, publication_status)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as SocialContentGroup | null) ?? null;
}

/** Crée ou réécrit le groupe et ses posts en une seule transaction. */
export async function saveGroupWithPosts(draft: SocialGroupDraft): Promise<string> {
  const posts = buildGroupPosts(draft);
  if (posts.length === 0) throw new Error(NO_CHANNEL_MESSAGE);
  const { data, error } = await db.rpc("save_social_content_group", {
    p_group_id: draft.groupId,
    p_format: draft.format,
    p_sync: draft.sync,
    p_posts: posts,
  });
  if (error) throw error;
  return data as string;
}

// ── Calendrier ─────────────────────────────────────────────────

/** Échelle affichée, de la moins avancée à la plus avancée (epic 2 l'étendra). */
export const DISPLAY_STATUS_ORDER: SocialPublicationStatus[] = ["unscheduled", "scheduled", "published"];

export const DISPLAY_STATUS_LABELS: Record<SocialPublicationStatus, string> = {
  unscheduled: "Brouillon",
  scheduled: "Programmé",
  published: "Publié",
};

/** Statut affiché d'un contenu : le moins avancé de ses déclinaisons. */
export function groupDisplayStatus(posts: Pick<SocialPost, "publication_status">[]): SocialPublicationStatus {
  if (posts.length === 0) return "unscheduled";
  return posts.reduce<SocialPublicationStatus>((min, p) => (
    DISPLAY_STATUS_ORDER.indexOf(p.publication_status) < DISPLAY_STATUS_ORDER.indexOf(min) ? p.publication_status : min
  ), "published");
}

/** Jour "YYYY-MM-DD" d'un instant, en heure de Paris. */
export function parisDayKey(iso: string): string {
  return utcIsoToParisLocal(iso).date;
}

export const DROP_DEFAULT_TIME = "09:00";

/** Nouvelle date d'un contenu déposé sur un jour : l'heure est gardée, 09:00 pour un brouillon sans date. */
export function moveKeepingTime(currentIso: string | null, dayKey: string): string {
  const time = currentIso ? utcIsoToParisLocal(currentIso).time : DROP_DEFAULT_TIME;
  return parisLocalToUtcIso(dayKey, time);
}

function keyToUtc(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function utcToKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(dayKey: string, n: number): string {
  const d = keyToUtc(dayKey);
  d.setUTCDate(d.getUTCDate() + n);
  return utcToKey(d);
}

/** Premier jour du mois décalé de n mois. */
export function addMonths(dayKey: string, n: number): string {
  const d = keyToUtc(dayKey);
  return utcToKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)));
}

/** Lundi de la semaine du jour. */
export function mondayOf(dayKey: string): string {
  const dow = (keyToUtc(dayKey).getUTCDay() + 6) % 7;
  return addDays(dayKey, -dow);
}

export interface CalendarDay {
  key: string;
  inMonth: boolean;
}

/** Semaines du lundi au dimanche couvrant le mois du jour donné. */
export function buildMonthGrid(dayKey: string): CalendarDay[][] {
  const first = addMonths(dayKey, 0);
  const month = first.slice(0, 7);
  const weeks: CalendarDay[][] = [];
  let start = mondayOf(first);
  while (weeks.length === 0 || start.slice(0, 7) === month) {
    weeks.push(Array.from({ length: 7 }, (_, i) => {
      const key = addDays(start, i);
      return { key, inMonth: key.slice(0, 7) === month };
    }));
    start = addDays(start, 7);
  }
  return weeks;
}

/** Les sept jours, du lundi au dimanche, de la semaine du jour donné. */
export function buildWeekGrid(dayKey: string): CalendarDay[] {
  const monday = mondayOf(dayKey);
  return Array.from({ length: 7 }, (_, i) => ({ key: addDays(monday, i), inMonth: true }));
}

/** Une carte : un contenu réduit à ses déclinaisons visibles. */
export interface CalendarCard {
  group: SocialContentGroup;
  posts: SocialPost[];
  status: SocialPublicationStatus;
  /** Date de la carte, null pour un brouillon. */
  scheduledAt: string | null;
}

/**
 * Répartit les contenus entre la colonne « Non planifiés » et les jours de
 * Paris. Seules les déclinaisons des canaux visibles comptent ; un contenu
 * sans déclinaison visible disparaît. Une carte va sur un jour dès qu'une
 * déclinaison visible est datée (quel que soit son statut) : la plus tôt dans
 * la plage chargée, à défaut la plus tôt. Le statut affiché reste le moins
 * avancé. Un groupe présent deux fois est gardé une seule fois (la première).
 */
export function placeGroups(
  groups: SocialContentGroup[],
  visibleChannelIds: ReadonlySet<string>,
  range?: { fromIso: string; toIso: string },
): { undated: CalendarCard[]; byDay: Map<string, CalendarCard[]> } {
  const undated: CalendarCard[] = [];
  const byDay = new Map<string, CalendarCard[]>();
  const seen = new Set<string>();
  const from = range ? Date.parse(range.fromIso) : -Infinity;
  const to = range ? Date.parse(range.toIso) : Infinity;
  for (const group of groups) {
    if (seen.has(group.id)) continue;
    seen.add(group.id);
    const posts = group.posts.filter((p) => visibleChannelIds.has(p.channel_id));
    if (posts.length === 0) continue;
    const status = groupDisplayStatus(posts);
    const dates = posts
      .filter((p) => p.scheduled_at)
      .map((p) => p.scheduled_at as string)
      .sort((a, b) => Date.parse(a) - Date.parse(b));
    if (dates.length === 0) {
      undated.push({ group, posts, status, scheduledAt: null });
      continue;
    }
    const scheduledAt = dates.find((d) => Date.parse(d) >= from && Date.parse(d) < to) ?? dates[0];
    const key = parisDayKey(scheduledAt);
    const day = byDay.get(key) ?? [];
    day.push({ group, posts, status, scheduledAt });
    byDay.set(key, day);
  }
  for (const day of byDay.values()) day.sort((a, b) => Date.parse(a.scheduledAt as string) - Date.parse(b.scheduledAt as string));
  return { undated, byDay };
}

const GROUP_SELECT = "id, format, sync, created_by, created_at, updated_at, posts:social_posts(id, group_id, channel_id, text, scheduled_at, publication_status)";

async function listGroupsByIds(ids: string[]): Promise<SocialContentGroup[]> {
  if (ids.length === 0) return [];
  const { data, error } = await db
    .from("social_content_groups")
    .select(GROUP_SELECT)
    .in("id", ids)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SocialContentGroup[];
}

/** Contenus ayant au moins une déclinaison datée dans [fromIso, toIso[, avec tous leurs posts. */
export async function listGroupsInRange(fromIso: string, toIso: string): Promise<SocialContentGroup[]> {
  const { data, error } = await db
    .from("social_posts")
    .select("group_id")
    .gte("scheduled_at", fromIso)
    .lt("scheduled_at", toIso);
  if (error) throw error;
  return listGroupsByIds([...new Set((data ?? []).map((r: { group_id: string }) => r.group_id))]);
}

/** Contenus ayant au moins une déclinaison sans date, avec tous leurs posts. */
export async function listUndatedGroups(): Promise<SocialContentGroup[]> {
  const { data, error } = await db
    .from("social_posts")
    .select("group_id")
    .eq("publication_status", "unscheduled");
  if (error) throw error;
  return listGroupsByIds([...new Set((data ?? []).map((r: { group_id: string }) => r.group_id))]);
}

/** Pose (ou retire avec null) la date des déclinaisons non publiées du groupe, en une seule RPC. */
export async function setGroupDate(groupId: string, scheduledAt: string | null): Promise<void> {
  const { error } = await db.rpc("set_social_group_date", { p_group_id: groupId, p_scheduled_at: scheduledAt });
  if (error) throw error;
}

/** Copie du groupe telle qu'après setGroupDate (mise à jour optimiste). */
export function withGroupDate(group: SocialContentGroup, scheduledAt: string | null): SocialContentGroup {
  return {
    ...group,
    posts: group.posts.map((p) => (p.publication_status === "published" ? p : {
      ...p,
      scheduled_at: scheduledAt,
      publication_status: scheduledAt ? "scheduled" : "unscheduled",
    })),
  };
}
