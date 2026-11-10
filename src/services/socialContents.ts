import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { PALETTE_COLORS } from "@/lib/colorPalette";
import { parisToIso } from "../../supabase/functions/_shared/nocrm-import";
import { computePostAlerts, type SocialPostAlert } from "../../supabase/functions/_shared/social-post-alerts";

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
  /** Visuel choisi dans la Médiathèque, null si absent ou supprimé. */
  media_id: string | null;
}

export interface SocialTheme {
  id: string;
  name: string;
  /** Couleur hexadécimale `#rrggbb`, en minuscules. */
  color: string;
}

export interface SocialContentGroup {
  id: string;
  format: SocialFormat;
  sync: boolean;
  /** Thème éditorial du contenu, null sans thème (ou thème supprimé). */
  theme_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  posts: SocialPost[];
  // Enrichissement (lot 1) : facultatifs, absents des contenus anciens ou des lectures partielles.
  title?: string | null;
  editorial_category?: SocialEditorialCategory | null;
  visual_type?: SocialVisualType | null;
  visual_message?: string | null;
  visual_elements?: string | null;
  visual_texts?: string | null;
  visual_composition?: string | null;
  visual_slides?: SocialVisualSlide[];
  internal_notes?: string | null;
  check_text_ready?: boolean;
  check_visual_ready?: boolean;
  check_links_checked?: boolean;
  check_proofread?: boolean;
  validated_at?: string | null;
  validated_by?: string | null;
  origin?: "app" | "ai";
  /** Expertises (thèmes multi-valeurs). */
  theme_links?: { theme_id: string }[];
  sources?: SocialSource[];
}

// ── Enrichissement d'un contenu ────────────────────────────────

export type SocialEditorialCategory = "tutorial" | "reflection" | "resource" | "behind_the_scenes" | "humor" | "community" | "offer";
export type SocialVisualType = "illustration" | "sketchnote" | "carousel" | "photo" | "video" | "diagram" | "other";

export const EDITORIAL_CATEGORY_LABELS: Record<SocialEditorialCategory, string> = {
  tutorial: "Conseil pratique / tutoriel",
  reflection: "Réflexion / prise de recul",
  resource: "Ressource / outil",
  behind_the_scenes: "Coulisses / retour d'expérience",
  humor: "Humour / contenu léger",
  community: "Participatif / communautaire",
  offer: "Offre / actualité SuperTilt",
};

export const VISUAL_TYPE_LABELS: Record<SocialVisualType, string> = {
  illustration: "Illustration",
  sketchnote: "Sketchnote",
  carousel: "Carrousel",
  photo: "Photo",
  video: "Vidéo",
  diagram: "Schéma",
  other: "Autre",
};

export interface SocialVisualSlide { content: string }

export interface SocialSource {
  id?: string;
  position?: number;
  url: string | null;
  label: string | null;
  content_card_id: string | null;
  content_card?: { id: string; title: string } | null;
}

export type SocialChecklistKey = "check_text_ready" | "check_visual_ready" | "check_links_checked" | "check_proofread";

export const CHECKLIST_ITEMS: { key: SocialChecklistKey; label: string }[] = [
  { key: "check_text_ready", label: "Texte finalisé" },
  { key: "check_visual_ready", label: "Visuel prêt" },
  { key: "check_links_checked", label: "Liens vérifiés" },
  { key: "check_proofread", label: "Relu" },
];

/** Champs communs du contenu enregistrés avec lui ; chaque clé absente est conservée en base. */
export interface SocialContentDetails {
  title?: string | null;
  editorial_category?: SocialEditorialCategory | null;
  visual_type?: SocialVisualType | null;
  visual_message?: string | null;
  visual_elements?: string | null;
  visual_texts?: string | null;
  visual_composition?: string | null;
  visual_slides?: SocialVisualSlide[];
  internal_notes?: string | null;
  check_text_ready?: boolean;
  check_visual_ready?: boolean;
  check_links_checked?: boolean;
  check_proofread?: boolean;
  theme_ids?: string[];
  sources?: Pick<SocialSource, "url" | "label" | "content_card_id">[];
}

export const TITLE_MAX = 120;
const DEFAULT_TITLE_LENGTH = 80;

/** Titre par défaut : début du texte, sur une ligne, coupé au dernier mot avant 80 caractères. */
export function defaultTitle(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= DEFAULT_TITLE_LENGTH) return flat;
  const cut = flat.slice(0, DEFAULT_TITLE_LENGTH);
  const space = cut.lastIndexOf(" ");
  return `${(space > 40 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Libellé d'une carte : titre interne, à défaut le début du texte (comme avant le lot 1). */
export function cardLabel(group: Pick<SocialContentGroup, "title">, text: string): string {
  return group.title?.trim() || text.trim();
}

/** Expertises du contenu ; l'ancien thème unique compte tant qu'aucune expertise n'est posée. */
export function groupThemeIds(group: Pick<SocialContentGroup, "theme_links" | "theme_id">): string[] {
  const links = group.theme_links?.map((l) => l.theme_id) ?? [];
  if (links.length > 0) return links;
  return group.theme_id ? [group.theme_id] : [];
}

export type SocialPreparationState = "to_complete" | "to_validate" | "validated";

export const PREPARATION_LABELS: Record<SocialPreparationState, string> = {
  to_complete: "À compléter",
  to_validate: "À valider",
  validated: "Validé",
};

/** Indicateur dérivé : à compléter tant qu'une case manque, à valider ensuite, validé une fois validé. */
export function preparationState(group: Partial<Pick<SocialContentGroup, SocialChecklistKey | "validated_at">>): SocialPreparationState {
  if (!CHECKLIST_ITEMS.every((i) => group[i.key] === true)) return "to_complete";
  return group.validated_at ? "validated" : "to_validate";
}

/** Sans visuel : une déclinaison non publiée n'a pas de visuel. */
export function hasMissingVisual(posts: Pick<SocialPost, "media_id" | "publication_status">[]): boolean {
  return posts.some((p) => p.publication_status !== "published" && !p.media_id);
}

export async function validateContent(groupId: string, validated: boolean): Promise<string | null> {
  const { data, error } = await db.rpc("validate_social_content", { p_group_id: groupId, p_validated: validated });
  if (error) throw error;
  return (data as string | null) ?? null;
}

/** Nom affichable d'un compte (validation), null s'il n'est pas lisible. */
export async function getProfileLabel(userId: string): Promise<string | null> {
  const { data } = await db.from("profiles").select("display_name, first_name, last_name, email").eq("user_id", userId).maybeSingle();
  if (!data) return null;
  const d = data as { display_name: string | null; first_name: string | null; last_name: string | null; email: string | null };
  return d.display_name || [d.first_name, d.last_name].filter(Boolean).join(" ") || d.email;
}

/** Cartes du kanban Newsletter liables comme source, par titre. */
export async function searchNewsletterCards(query: string): Promise<{ id: string; title: string }[]> {
  let q = db.from("content_cards").select("id, title").order("updated_at", { ascending: false }).limit(20);
  if (query.trim()) q = q.ilike("title", `%${query.trim()}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as { id: string; title: string }[];
}

/** État du composeur, tel qu'il est enregistré. */
export interface SocialGroupDraft {
  groupId: string;
  format: SocialFormat;
  sync: boolean;
  themeId: string | null;
  channelIds: string[];
  /** Texte commun, utilisé tant que la synchro est active. */
  commonText: string;
  /** Texte propre à chaque canal, utilisé quand la synchro est coupée. */
  texts: Record<string, string>;
  /** Visuel commun, utilisé tant que la synchro est active. */
  commonMediaId: string | null;
  /** Visuel propre à chaque canal, utilisé quand la synchro est coupée. */
  mediaIds: Record<string, string | null>;
  scheduledAt: string | null;
  /** Statut choisi par canal ; absent : statut enregistré conservé, Brouillon à la création. */
  statuses?: Record<string, SocialDraftStatus>;
  /** Champs communs (lot 1) ; absent : seuls le contenu et ses déclinaisons sont réécrits. */
  details?: SocialContentDetails;
}

/** Statuts choisis à la main ; « Publié » passe par le bouton « Marquer publié ». */
export type SocialDraftStatus = Exclude<SocialPublicationStatus, "published">;

export const SCHEDULE_NEEDS_DATE_MESSAGE = "Indiquez une date et une heure pour programmer";
export const UNSCHEDULE_BEFORE_CLEARING_DATE_MESSAGE = "Repassez en Brouillon avant de retirer la date";

/** Message de refus d'un changement de statut, null s'il est permis. Programmé exige une date. */
export function validateStatusChange(next: SocialDraftStatus, scheduledAt: string | null): string | null {
  return next === "scheduled" && !scheduledAt ? SCHEDULE_NEEDS_DATE_MESSAGE : null;
}

/** Message de refus du retrait de la date, null s'il est permis : aucune déclinaison ne doit rester Programmé. */
export function validateDateRemoval(statuses: SocialPublicationStatus[]): string | null {
  return statuses.includes("scheduled") ? UNSCHEDULE_BEFORE_CLEARING_DATE_MESSAGE : null;
}

export interface SocialPostInput {
  channel_id: string;
  text: string;
  scheduled_at: string | null;
  media_id: string | null;
  publication_status?: SocialDraftStatus;
}

/** Un post par canal coché : texte et visuel communs si synchro, propres sinon. */
export function buildGroupPosts(draft: Omit<SocialGroupDraft, "groupId" | "format" | "themeId">): SocialPostInput[] {
  return [...new Set(draft.channelIds)].map((channel_id) => ({
    channel_id,
    text: draft.sync ? draft.commonText : (draft.texts[channel_id] ?? draft.commonText),
    scheduled_at: draft.scheduledAt,
    media_id: draft.sync
      ? draft.commonMediaId
      : (channel_id in draft.mediaIds ? draft.mediaIds[channel_id] : draft.commonMediaId),
    ...(draft.statuses?.[channel_id] ? { publication_status: draft.statuses[channel_id] } : {}),
  }));
}

export interface PublishedPostEdit {
  postId: string;
  text: string;
  mediaId: string | null;
}

/**
 * Déclinaisons publiées dont le texte ou le visuel saisi diffère de la base.
 * Elles s'enregistrent une par une, hors de save_social_content_group, qui ne
 * réécrit jamais une publiée.
 */
export function publishedPostEdits(
  posts: Pick<SocialPost, "id" | "channel_id" | "text" | "media_id" | "publication_status">[],
  draft: Pick<SocialGroupDraft, "channelIds" | "texts" | "mediaIds">,
): PublishedPostEdit[] {
  return posts
    .filter((p) => p.publication_status === "published" && draft.channelIds.includes(p.channel_id))
    .map((p) => ({
      post: p,
      edit: {
        postId: p.id,
        text: draft.texts[p.channel_id] ?? p.text,
        mediaId: p.channel_id in draft.mediaIds ? draft.mediaIds[p.channel_id] : p.media_id,
      },
    }))
    .filter(({ post, edit }) => edit.text !== post.text || edit.mediaId !== post.media_id)
    .map(({ edit }) => edit);
}

export type { SocialPostAlert };

export interface ChannelAlerts {
  channelId: string;
  alerts: SocialPostAlert[];
}

/**
 * Alertes par canal, en ne gardant que les canaux qui en ont. Une déclinaison
 * publiée ne peut plus être corrigée : elle n'a jamais d'alerte.
 */
export function alertsByChannel(
  posts: (Pick<SocialPostInput, "channel_id" | "text" | "media_id"> & { publication_status?: SocialPublicationStatus })[],
  channelsById: ReadonlyMap<string, Pick<SocialChannel, "text_limit">>,
): ChannelAlerts[] {
  return posts
    .filter((p) => p.publication_status !== "published")
    .map((p) => ({ channelId: p.channel_id, alerts: computePostAlerts(p, channelsById.get(p.channel_id)) }))
    .filter((a) => a.alerts.length > 0);
}

const PARIS = "Europe/Paris";

/** Jour "YYYY-MM-DD" et heure "HH:MM" à Paris -> instant ISO UTC. */
export function parisLocalToUtcIso(date: string, time: string): string {
  const iso = parisToIso(`${date} ${time}`);
  if (!iso) throw new Error(`Date invalide : ${date} ${time}`);
  return iso;
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

const GROUP_SELECT = "id, format, sync, theme_id, created_by, created_at, updated_at, "
  + "title, editorial_category, visual_type, visual_message, visual_elements, visual_texts, visual_composition, visual_slides, "
  + "internal_notes, check_text_ready, check_visual_ready, check_links_checked, check_proofread, validated_at, validated_by, origin, "
  + "theme_links:social_content_group_themes(theme_id), "
  + "sources:social_content_sources(id, position, url, label, content_card_id, content_card:content_cards(id, title)), "
  + "posts:social_posts(id, group_id, channel_id, text, scheduled_at, publication_status, media_id)";

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
    .select(GROUP_SELECT)
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
    p_theme_id: draft.themeId,
    ...(draft.details ? { p_details: draft.details } : {}),
  });
  if (error) throw error;
  return data as string;
}

// ── Thèmes ─────────────────────────────────────────────────────

export const THEME_NAME_TAKEN_MESSAGE = "Un thème porte déjà ce nom";
export const THEME_NAME_EMPTY_MESSAGE = "Le nom du thème est obligatoire";

/** Traduit la violation d'unicité du nom (insensible à la casse) en message clair. */
function themeError<E extends { code?: string }>(error: E): E | Error {
  return error.code === "23505" ? new Error(THEME_NAME_TAKEN_MESSAGE) : error;
}

export async function listThemes(): Promise<SocialTheme[]> {
  const { data, error } = await db
    .from("social_themes")
    .select("id, name, color")
    .order("name");
  if (error) throw error;
  return (data ?? []) as SocialTheme[];
}

export async function createTheme(input: { name: string; color: string }): Promise<SocialTheme> {
  const name = input.name.trim();
  if (!name) throw new Error(THEME_NAME_EMPTY_MESSAGE);
  const { data, error } = await db
    .from("social_themes")
    .insert({ name, color: input.color.toLowerCase() })
    .select("id, name, color")
    .single();
  if (error) throw themeError(error);
  return data as SocialTheme;
}

export async function updateTheme(id: string, patch: { name?: string; color?: string }): Promise<void> {
  const values: { name?: string; color?: string } = {};
  if (patch.name !== undefined) {
    values.name = patch.name.trim();
    if (!values.name) throw new Error(THEME_NAME_EMPTY_MESSAGE);
  }
  if (patch.color !== undefined) values.color = patch.color.toLowerCase();
  const { error } = await db.from("social_themes").update(values).eq("id", id);
  if (error) throw themeError(error);
}

export async function deleteTheme(id: string): Promise<void> {
  const { error } = await db.from("social_themes").delete().eq("id", id);
  if (error) throw error;
}

// ── Filtres ────────────────────────────────────────────────────

/** Pastilles sélectionnées : ET entre familles, OU dans une famille, famille vide = pas de filtre. */
export type SocialPracticalFilter = "no_visual" | "to_complete" | "to_validate";

export const PRACTICAL_FILTER_LABELS: Record<SocialPracticalFilter, string> = {
  no_visual: "Sans visuel",
  to_complete: "À compléter",
  to_validate: "À valider",
};

export interface SocialFilters {
  themeIds: Set<string>;
  channelIds: Set<string>;
  statuses: Set<SocialPublicationStatus>;
  categories?: Set<SocialEditorialCategory>;
  practical?: Set<SocialPracticalFilter>;
}

export const emptySocialFilters = (): SocialFilters => ({
  themeIds: new Set(),
  channelIds: new Set(),
  statuses: new Set(),
  categories: new Set(),
  practical: new Set(),
});

/** Canaux visibles pour placeGroups : ceux de la famille Réseau, tous si elle est vide. */
export function visibleChannelIdsFor(filters: SocialFilters, channels: Pick<SocialChannel, "id">[]): Set<string> {
  return filters.channelIds.size > 0 ? new Set(filters.channelIds) : new Set(channels.map((c) => c.id));
}

/**
 * Filtre des cartes déjà réduites aux réseaux visibles par placeGroups : thème
 * du contenu et statut affiché de la carte. Un contenu sans thème est masqué
 * dès qu'une pastille de thème est active.
 */
export function filterCards(
  cards: CalendarCard[],
  filters: Pick<SocialFilters, "themeIds" | "statuses" | "categories" | "practical">,
): CalendarCard[] {
  const categories = filters.categories ?? new Set();
  const practical = filters.practical ?? new Set();
  return cards.filter((card) => {
    const prep = preparationState(card.group);
    const matchesPractical = (f: SocialPracticalFilter) => (
      f === "no_visual" ? hasMissingVisual(card.posts) : prep === f
    );
    return (filters.themeIds.size === 0 || groupThemeIds(card.group).some((id) => filters.themeIds.has(id)))
      && (filters.statuses.size === 0 || filters.statuses.has(card.status))
      && (categories.size === 0 || (!!card.group.editorial_category && categories.has(card.group.editorial_category)))
      && (practical.size === 0 || [...practical].some(matchesPractical));
  });
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

export const PUBLISHED_NOT_MOVABLE_MESSAGE = "Un contenu publié ne se déplace pas";

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
  /** Alertes des déclinaisons visibles, par canal ; vide si aucune. */
  alerts: ChannelAlerts[];
}

/**
 * Répartit les contenus entre la colonne « Non planifiés » et les jours de
 * Paris. Seules les déclinaisons des canaux visibles comptent ; un contenu
 * sans déclinaison visible disparaît. Une carte va sur un jour dès qu'une
 * déclinaison visible est datée : la plus tôt des non publiées dans la plage
 * chargée, sinon la plus tôt de toutes dans la plage, à défaut la plus tôt des
 * non publiées puis de toutes. Le statut affiché reste le moins
 * avancé. Un groupe présent deux fois est gardé une seule fois (la première).
 * Les alertes sont calculées sur les déclinaisons visibles non publiées, avec la limite
 * de texte des canaux fournis (sans canal connu : pas d'alerte de longueur).
 */
export function placeGroups(
  groups: SocialContentGroup[],
  visibleChannelIds: ReadonlySet<string>,
  range?: { fromIso: string; toIso: string },
  channelsById: ReadonlyMap<string, Pick<SocialChannel, "text_limit">> = new Map(),
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
    const alerts = alertsByChannel(posts, channelsById);
    // La date de la carte (et donc celle que garde un glisser-déposer) vient des déclinaisons non
    // publiées ; les publiées ne comptent que si aucune non publiée n'est datée.
    const datesOf = (list: SocialPost[]) => list
      .filter((p) => p.scheduled_at)
      .map((p) => p.scheduled_at as string)
      .sort((a, b) => Date.parse(a) - Date.parse(b));
    const pending = datesOf(posts.filter((p) => p.publication_status !== "published"));
    const all = datesOf(posts);
    if (all.length === 0) {
      undated.push({ group, posts, status, scheduledAt: null, alerts });
      continue;
    }
    // Une date de la plage chargée passe avant une date hors plage : sinon la carte serait rangée
    // sur un jour absent de la grille et disparaîtrait de la vue.
    const inRange = (list: string[]) => list.find((d) => Date.parse(d) >= from && Date.parse(d) < to);
    const scheduledAt = inRange(pending) ?? inRange(all) ?? pending[0] ?? all[0];
    const key = parisDayKey(scheduledAt);
    const day = byDay.get(key) ?? [];
    day.push({ group, posts, status, scheduledAt, alerts });
    byDay.set(key, day);
  }
  for (const day of byDay.values()) day.sort((a, b) => Date.parse(a.scheduledAt as string) - Date.parse(b.scheduledAt as string));
  return { undated, byDay };
}

/**
 * Ce que le calendrier affiche, filtres compris : placement sur les réseaux
 * visibles, puis thème et statut sur la grille comme sur « Non planifiés ».
 * Une pastille sélectionnée qui n'existe plus (thème supprimé, canal retiré ou
 * désactivé) ne filtre plus, faute de pouvoir être désélectionnée. Les jours
 * vidés par le filtre disparaissent de la grille.
 */
export function applySocialFilters(
  groups: SocialContentGroup[],
  filters: SocialFilters,
  channels: Pick<SocialChannel, "id" | "text_limit">[],
  existingThemeIds: ReadonlySet<string>,
  range?: { fromIso: string; toIso: string },
  channelsById: ReadonlyMap<string, Pick<SocialChannel, "text_limit">> = new Map(channels.map((c) => [c.id, c])),
): { undated: CalendarCard[]; byDay: Map<string, CalendarCard[]> } {
  const channelIds = new Set(channels.map((c) => c.id));
  const active: SocialFilters = {
    themeIds: new Set([...filters.themeIds].filter((id) => existingThemeIds.has(id))),
    channelIds: new Set([...filters.channelIds].filter((id) => channelIds.has(id))),
    statuses: filters.statuses,
    categories: filters.categories,
    practical: filters.practical,
  };
  const placed = placeGroups(groups, visibleChannelIdsFor(active, channels), range, channelsById);
  const byDay = new Map<string, CalendarCard[]>();
  for (const [day, cards] of placed.byDay) {
    const kept = filterCards(cards, active);
    if (kept.length > 0) byDay.set(day, kept);
  }
  return { undated: filterCards(placed.undated, active), byDay };
}

/** Groupes ayant au moins une déclinaison retenue par le filtre, avec tous leurs posts, en une requête. */
async function listGroupsMatching(
  filter: (q: ReturnType<ReturnType<typeof db.from>["select"]>) => ReturnType<ReturnType<typeof db.from>["select"]>,
): Promise<SocialContentGroup[]> {
  const { data, error } = await filter(
    db.from("social_content_groups").select(`${GROUP_SELECT}, matched:social_posts!inner(id)`),
  ).order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as (SocialContentGroup & { matched?: unknown })[]).map(({ matched: _matched, ...group }) => group);
}

/** Contenus ayant au moins une déclinaison datée dans [fromIso, toIso[, avec tous leurs posts. */
export async function listGroupsInRange(fromIso: string, toIso: string): Promise<SocialContentGroup[]> {
  return listGroupsMatching((q) => q.gte("matched.scheduled_at", fromIso).lt("matched.scheduled_at", toIso));
}

/** Contenus ayant au moins une déclinaison sans date, avec tous leurs posts (un brouillon daté n'y figure pas). */
export async function listUndatedGroups(): Promise<SocialContentGroup[]> {
  return listGroupsMatching((q) => q.is("matched.scheduled_at", null));
}

/** Pose (ou retire avec null) la date des déclinaisons non publiées du groupe, en une seule RPC. */
export async function setGroupDate(groupId: string, scheduledAt: string | null): Promise<void> {
  const { error } = await db.rpc("set_social_group_date", { p_group_id: groupId, p_scheduled_at: scheduledAt });
  if (error) throw error;
}

// ── Marquage publié et suppression ─────────────────────────────

/** Marque une seule déclinaison publiée, ou annule le marquage (programmé si datée, sans date sinon). */
export async function setPostPublished(postId: string, published: boolean): Promise<SocialPublicationStatus> {
  const { data, error } = await db.rpc("set_social_post_published", { p_post_id: postId, p_published: published });
  if (error) throw error;
  return data as SocialPublicationStatus;
}

/** Texte et visuel d'une déclinaison publiée, sur cette seule ligne, sans propagation. */
export async function updatePublishedPost(postId: string, text: string, mediaId: string | null): Promise<void> {
  const { error } = await db.rpc("update_social_post_content", { p_post_id: postId, p_text: text, p_media_id: mediaId });
  if (error) throw error;
}

export const POST_NOT_DELETED_MESSAGE = "Déclinaison introuvable ou suppression non autorisée";
export const GROUP_NOT_DELETED_MESSAGE = "Contenu introuvable ou suppression non autorisée";

/** Supprime une déclinaison ; la base supprime le contenu s'il n'en a plus. Zéro ligne (RLS) : erreur. */
export async function deletePost(postId: string): Promise<void> {
  const { data, error } = await db.from("social_posts").delete().eq("id", postId).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error(POST_NOT_DELETED_MESSAGE);
}

/** Supprime le contenu et toutes ses déclinaisons. Zéro ligne (RLS) : erreur. */
export async function deleteGroup(groupId: string): Promise<void> {
  const { data, error } = await db.from("social_content_groups").delete().eq("id", groupId).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error(GROUP_NOT_DELETED_MESSAGE);
}

/** Copie du groupe telle qu'après setGroupDate (mise à jour optimiste) : la date change, jamais le statut. */
export function withGroupDate(group: SocialContentGroup, scheduledAt: string | null): SocialContentGroup {
  return {
    ...group,
    posts: group.posts.map((p) => (p.publication_status === "published" ? p : {
      ...p,
      scheduled_at: scheduledAt,
    })),
  };
}

// ── Notes du calendrier ────────────────────────────────────────

/** Palette des thèmes et des notes, partagée avec les missions. */
export const THEME_COLORS = PALETTE_COLORS;

export const NOTE_TEXT_MAX = 500;
export const NOTE_TEXT_EMPTY_MESSAGE = "Le texte de la note est obligatoire";
export const NOTE_TEXT_TOO_LONG_MESSAGE = `Le texte de la note ne dépasse pas ${NOTE_TEXT_MAX} caractères`;
export const NOTE_NOT_FOUND_MESSAGE = "Note introuvable ou modification non autorisée";

/** Longueur d'un texte de note en points de code, comme char_length en base (un emoji compte pour un). */
export function noteTextLength(text: string): number {
  return [...text].length;
}

/** Texte de note débarrassé des blancs de bord, refusé vide ou trop long. */
function cleanNoteText(raw: string): string {
  const text = raw.trim();
  if (!text) throw new Error(NOTE_TEXT_EMPTY_MESSAGE);
  if (noteTextLength(text) > NOTE_TEXT_MAX) throw new Error(NOTE_TEXT_TOO_LONG_MESSAGE);
  return text;
}

/** Repère du calendrier : un jour sans heure ("YYYY-MM-DD"), un texte, une couleur. Hors statuts, filtres et compteurs. */
export interface SocialCalendarNote {
  id: string;
  day: string;
  text: string;
  color: string;
  created_at: string;
}

const NOTE_SELECT = "id, day, text, color, created_at";

/** Notes des jours fromDay à toDay inclus (clés "YYYY-MM-DD"). */
export async function listNotesInRange(fromDay: string, toDay: string): Promise<SocialCalendarNote[]> {
  const { data, error } = await db
    .from("social_calendar_notes")
    .select(NOTE_SELECT)
    .gte("day", fromDay)
    .lte("day", toDay)
    .order("day")
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as SocialCalendarNote[];
}

export async function createNote(input: { day: string; text: string; color: string }): Promise<SocialCalendarNote> {
  const text = cleanNoteText(input.text);
  const { data, error } = await db
    .from("social_calendar_notes")
    .insert({ day: input.day, text, color: input.color.toLowerCase() })
    .select(NOTE_SELECT)
    .single();
  if (error) throw error;
  return data as SocialCalendarNote;
}

export async function updateNote(id: string, patch: { day?: string; text?: string; color?: string }): Promise<void> {
  const values: { day?: string; text?: string; color?: string } = {};
  if (patch.day !== undefined) values.day = patch.day;
  if (patch.text !== undefined) values.text = cleanNoteText(patch.text);
  if (patch.color !== undefined) values.color = patch.color.toLowerCase();
  const { data, error } = await db.from("social_calendar_notes").update(values).eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error(NOTE_NOT_FOUND_MESSAGE);
}

/** Zéro ligne supprimée (note disparue ou RLS) : erreur. */
export async function deleteNote(id: string): Promise<void> {
  const { data, error } = await db.from("social_calendar_notes").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error(NOTE_NOT_FOUND_MESSAGE);
}

/** Notes groupées par jour, dans l'ordre de création. Aucun filtre ne s'y applique. */
export function notesByDay(notes: SocialCalendarNote[]): Map<string, SocialCalendarNote[]> {
  const byDay = new Map<string, SocialCalendarNote[]>();
  const sorted = [...notes].sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const note of sorted) {
    const day = byDay.get(note.day) ?? [];
    day.push(note);
    byDay.set(note.day, day);
  }
  return byDay;
}
