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
