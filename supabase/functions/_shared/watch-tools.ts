import { getSupabaseClient } from "./mod.ts";
import { embedText } from "./embeddings.ts";
import { getAppUrls } from "./app-urls.ts";

/**
 * Écriture et lecture du module Veille depuis un agent (serveur MCP).
 *
 * Un agent de veille qui publie dans Slack produit un flux qui disparaît :
 * rien n'est recherchable, dédupliqué ni rattaché aux clusters existants.
 * Ces deux fonctions déposent le même contenu dans `watch_items`, où il
 * bénéficie de la recherche, des tags, du score de fraîcheur et du digest
 * hebdomadaire.
 *
 * L'écriture est ADDITIVE : elle crée une ligne, n'en modifie et n'en
 * supprime aucune. Un doublon n'écrase rien — il est refusé et l'élément
 * existant est renvoyé.
 *
 * L'embedding est calculé ici (et réutilisé pour l'insertion) : c'est lui qui
 * porte la détection de doublon et le clustering. Le reste du pipeline
 * d'enrichissement (scraping, OCR, transcription, titre/tags automatiques)
 * n'a pas lieu d'être : l'agent a déjà lu la source et fournit titre, résumé
 * et tags.
 */

export type Supabase = ReturnType<typeof getSupabaseClient>;
export type AuditFn = (label: string) => Promise<void>;

/** Plafonds de saisie — le corps est du HTML simple rendu tel quel dans la fiche. */
export const WATCH_BODY_MAX_CHARS = 20000;
export const WATCH_COMMENT_MAX_CHARS = 2000;
export const WATCH_TAGS_MAX = 8;

/** Seuil de similarité cosinus au-delà duquel deux contenus sont le même. */
export const WATCH_DUPLICATE_THRESHOLD = 0.92;

const LIST_DEFAULT_LIMIT = 20;
const LIST_MAX_LIMIT = 100;
const LIST_EXCERPT_CHARS = 400;

export interface WatchItemInput {
  title?: string;
  body?: string;
  comment?: string;
  source_url?: string;
  tags?: string[];
  is_shared?: boolean;
  /** Passe outre la détection de doublon (à n'utiliser qu'après vérification). */
  force?: boolean;
}

export interface WatchListInput {
  search?: string;
  tags?: string[];
  days?: number;
  shared_only?: boolean;
  limit?: number;
}

interface WatchDuplicate {
  id: string;
  title: string;
  reason: "source_url" | "similarity";
  similarity?: number;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|h\d|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** Tags normalisés : minuscules, sans doublon, sans vide, plafonnés. */
export function normalizeWatchTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  for (const raw of tags) {
    const tag = String(raw ?? "").trim().toLowerCase();
    if (tag) seen.add(tag);
    if (seen.size >= WATCH_TAGS_MAX) break;
  }
  return Array.from(seen);
}

/** N'accepte qu'une URL http(s) — la fiche affiche ce lien comme source. */
function normalizeSourceUrl(raw?: string): string | null {
  const trimmed = (raw || "").trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("source_url doit être une URL absolue (http:// ou https://)");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("source_url doit être une URL absolue (http:// ou https://)");
  }
  return trimmed;
}

/**
 * Cherche un contenu déjà présent : d'abord l'URL exacte (gratuit et sûr),
 * puis la similarité sémantique. Renvoie aussi l'embedding calculé pour qu'il
 * soit stocké sans second appel à OpenAI.
 *
 * `force` ne lève que le contrôle de similarité, jamais celui de l'URL : deux
 * fiches sur la même adresse sont le même contenu, sans exception.
 */
async function findWatchDuplicate(
  supabase: Supabase,
  sourceUrl: string | null,
  text: string,
  force: boolean,
): Promise<{ duplicate: WatchDuplicate | null; embedding: number[] | null }> {
  if (sourceUrl) {
    const { data } = await supabase
      .from("watch_items")
      .select("id, title")
      .eq("source_url", sourceUrl)
      .limit(1);
    const existing = (data as Array<{ id: string; title: string }> | null)?.[0];
    if (existing) {
      return {
        duplicate: { id: existing.id, title: existing.title, reason: "source_url" },
        embedding: null,
      };
    }
  }

  const embedding = text.length > 20 ? await embedText(text) : null;
  if (!embedding || force) return { duplicate: null, embedding };

  const { data } = await supabase.rpc("match_watch_items", {
    query_embedding: JSON.stringify(embedding),
    match_threshold: WATCH_DUPLICATE_THRESHOLD,
    match_count: 1,
  });
  const similar = (data as Array<{ id: string; title: string; similarity: number }> | null)?.[0];
  if (similar) {
    return {
      duplicate: {
        id: similar.id,
        title: similar.title,
        reason: "similarity",
        similarity: Math.round(similar.similarity * 1000) / 1000,
      },
      embedding,
    };
  }

  return { duplicate: null, embedding };
}

/** Lien profond vers la fiche dans SuperTools (même forme que l'email de tag). */
async function watchItemUrl(itemId: string): Promise<string> {
  const urls = await getAppUrls();
  return `${urls.app_url}/veille?item=${itemId}`;
}

/**
 * Dépose un contenu dans la veille SuperTools.
 *
 * Refuse un doublon au lieu de l'écrire : l'agent publie tous les jours, et
 * deux exécutions sur la même source ne doivent pas remplir le module de
 * copies. `force` permet de passer outre après vérification humaine.
 */
export async function saveWatchItem(
  supabase: Supabase,
  input: WatchItemInput,
  createdBy: string | null,
  audit: AuditFn,
): Promise<string> {
  const title = (input.title || "").trim();
  if (!title) throw new Error("title est obligatoire");

  const body = (input.body || "").trim();
  const comment = (input.comment || "").trim();
  const sourceUrl = normalizeSourceUrl(input.source_url);

  if (!body && !sourceUrl) {
    throw new Error("Fournir au moins source_url (le lien de la source) ou body (le contenu)");
  }
  if (body.length > WATCH_BODY_MAX_CHARS) {
    throw new Error(
      `body dépasse la limite de ${WATCH_BODY_MAX_CHARS} caractères (${body.length}) : résumer, ou déposer plusieurs contenus`,
    );
  }
  if (comment.length > WATCH_COMMENT_MAX_CHARS) {
    throw new Error(
      `comment dépasse la limite de ${WATCH_COMMENT_MAX_CHARS} caractères (${comment.length})`,
    );
  }

  const tags = normalizeWatchTags(input.tags);
  const searchText = [title, stripHtml(body), comment].filter(Boolean).join("\n").slice(0, 8000);

  const { duplicate, embedding } = await findWatchDuplicate(
    supabase,
    sourceUrl,
    searchText,
    input.force === true,
  );

  if (duplicate) {
    await audit(`save_watch_item refusé (doublon ${duplicate.reason}) : ${title.slice(0, 120)}`);
    return JSON.stringify({
      saved: false,
      reason: "duplicate",
      existing: duplicate,
      existing_url: await watchItemUrl(duplicate.id),
      hint: duplicate.reason === "source_url"
        ? "Cette URL est déjà dans la veille. Ne pas la republier ; commenter l'élément existant dans SuperTools si l'angle est nouveau."
        : "Un contenu très proche est déjà dans la veille. Rappeler avec force=true seulement s'il s'agit vraiment d'une autre source.",
    });
  }

  const row: Record<string, unknown> = {
    title: title.slice(0, 300),
    body,
    comment,
    content_type: sourceUrl ? "url" : "text",
    source_url: sourceUrl,
    tags,
    is_shared: input.is_shared === true,
    created_by: createdBy,
  };
  if (embedding) row.embedding = JSON.stringify(embedding);

  await audit(`save_watch_item : ${title.slice(0, 120)}${sourceUrl ? ` (${sourceUrl})` : ""}`);

  const { data: created, error } = await supabase
    .from("watch_items")
    .insert(row)
    .select("id, title, tags, content_type, source_url, is_shared, created_at")
    .single();
  if (error) throw new Error(error.message);

  const item = created as { id: string };
  return JSON.stringify({
    saved: true,
    item: created,
    url: await watchItemUrl(item.id),
    hint:
      "Contenu déposé dans la veille SuperTools. Il est recherchable, entre dans le digest hebdomadaire " +
      "et peut être repris dans un cluster. Aucun élément existant n'a été modifié.",
  });
}

/**
 * Liste ce qui est déjà dans la veille — à appeler avant de publier pour ne
 * pas répéter ce qui a été couvert.
 */
export async function listWatchItems(
  supabase: Supabase,
  input: WatchListInput,
  audit: AuditFn,
): Promise<string> {
  const limit = Math.min(Math.max(Number(input.limit) || LIST_DEFAULT_LIMIT, 1), LIST_MAX_LIMIT);
  const days = Number(input.days) > 0 ? Number(input.days) : null;
  const tags = normalizeWatchTags(input.tags);

  // Les filtres s'appliquent avant order/limit : une fois transformée, la
  // requête n'accepte plus de filtre (PostgrestTransformBuilder).
  let query = supabase
    .from("watch_items")
    .select("id, title, body, comment, tags, content_type, source_url, is_shared, created_at");

  if (input.search) {
    const term = String(input.search).replace(/[%,()]/g, " ").trim();
    if (term) query = query.or(`title.ilike.%${term}%,body.ilike.%${term}%`);
  }
  if (tags.length > 0) query = query.overlaps("tags", tags);
  if (input.shared_only === true) query = query.eq("is_shared", true);
  if (days) {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    query = query.gte("created_at", since);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  await audit(
    `list_watch_items (${input.search ? `recherche "${input.search}", ` : ""}${days ? `${days} jours, ` : ""}${limit} max)`,
  );

  const items = (data as Array<Record<string, unknown>> | null) ?? [];
  return JSON.stringify({
    count: items.length,
    items: items.map((item) => ({
      ...item,
      body: stripHtml(String(item.body ?? "")).slice(0, LIST_EXCERPT_CHARS),
    })),
    hint: items.length === limit
      ? `Liste tronquée à ${limit} éléments : affiner avec search, tags ou days.`
      : undefined,
  });
}

// ── Registre des sources de veille ──────────────────────────────────────
//
// Les agents de veille planifiés gèrent leurs sources via watch_sources :
// ils listent ce qui est suivi, proposent de nouvelles sources et mettent à
// jour le statut / l'utilité. L'URL est canonisée par la fonction SQL
// normalize_watch_source_url (aussi appliquée par le trigger de la table) :
// la détection de doublon passe par elle, jamais par la chaîne brute.

export const WATCH_SOURCE_EXPERTS = [
  "strategie", "commercial-reseau", "marketing-seo", "ic-facilitation",
  "pedagogie-qualite", "ia-supertools", "productivite", "daf-juridique",
  "evenements", "concurrence", "newsletters",
] as const;
export const WATCH_SOURCE_TYPES = [
  "newsletter", "podcast", "youtube", "tiktok", "linkedin", "blog", "revue", "site", "autre",
] as const;
export const WATCH_SOURCE_LANGUAGES = ["fr", "en", "autre"] as const;
export const WATCH_SOURCE_STATUSES = ["proposed", "to_subscribe", "followed", "dropped"] as const;

const SOURCES_DEFAULT_LIMIT = 100;
const SOURCES_MAX_LIMIT = 500;

export interface WatchSourceListInput {
  expert?: string;
  status?: string | string[];
  type?: string;
  language?: string;
  search?: string;
  limit?: number;
}

export interface WatchSourceProposeInput {
  expert?: string;
  theme?: string;
  name?: string;
  type?: string;
  language?: string;
  url?: string;
  why?: string;
  how_to_follow?: string;
  proposed_by?: string;
}

export interface WatchSourceUpdateInput {
  id?: string;
  url?: string;
  status?: string;
  usefulness?: number;
  notes?: string;
  theme?: string;
  last_useful_at?: string;
  items_count?: number;
}

function checkEnum(value: string, allowed: readonly string[], field: string): string {
  if (!allowed.includes(value)) {
    throw new Error(`${field} invalide (« ${value} »). Valeurs acceptées : ${allowed.join(", ")}`);
  }
  return value;
}

/** Canonise une URL comme le trigger de la table (doublons cohérents). */
async function normalizeWatchSourceUrl(supabase: Supabase, raw: string): Promise<string> {
  const { data, error } = await supabase.rpc("normalize_watch_source_url", { value: raw });
  if (error) throw new Error(`url invalide : ${error.message}`);
  return String(data);
}

export async function listWatchSources(
  supabase: Supabase,
  input: WatchSourceListInput,
  audit: AuditFn,
): Promise<string> {
  const limit = Math.min(Math.max(Number(input.limit) || SOURCES_DEFAULT_LIMIT, 1), SOURCES_MAX_LIMIT);

  let query = supabase.from("watch_sources").select("*");

  if (input.expert) query = query.eq("expert", checkEnum(input.expert, WATCH_SOURCE_EXPERTS, "expert"));
  if (input.type) query = query.eq("type", checkEnum(input.type, WATCH_SOURCE_TYPES, "type"));
  if (input.language) query = query.eq("language", checkEnum(input.language, WATCH_SOURCE_LANGUAGES, "language"));
  if (input.status) {
    const statuses = (Array.isArray(input.status) ? input.status : [input.status])
      .map((s) => checkEnum(String(s), WATCH_SOURCE_STATUSES, "status"));
    query = statuses.length === 1 ? query.eq("status", statuses[0]) : query.in("status", statuses);
  }
  if (input.search) {
    const term = String(input.search).replace(/[%,()]/g, " ").trim();
    if (term) query = query.or(`name.ilike.%${term}%,why.ilike.%${term}%,theme.ilike.%${term}%`);
  }

  const { data, error } = await query.order("expert").order("name").limit(limit);
  if (error) throw new Error(error.message);

  await audit(`list_watch_sources (${input.expert ?? "tous experts"}, ${limit} max)`);

  const sources = (data as Array<Record<string, unknown>> | null) ?? [];
  return JSON.stringify({
    count: sources.length,
    sources,
    hint: sources.length === limit
      ? `Liste tronquée à ${limit} sources : affiner avec expert, status, type ou search.`
      : undefined,
  });
}

/**
 * Propose une nouvelle source (statut « proposed »). Si l'URL canonisée
 * existe déjà, rien n'est créé et la source existante est rendue — même
 * comportement que save_watch_item face à un doublon.
 */
export async function proposeWatchSource(
  supabase: Supabase,
  input: WatchSourceProposeInput,
  audit: AuditFn,
): Promise<string> {
  const name = (input.name || "").trim();
  if (!name) throw new Error("name est obligatoire");
  const expert = checkEnum(String(input.expert || ""), WATCH_SOURCE_EXPERTS, "expert");
  const type = checkEnum(String(input.type || ""), WATCH_SOURCE_TYPES, "type");
  const language = checkEnum(String(input.language || ""), WATCH_SOURCE_LANGUAGES, "language");
  const rawUrl = (input.url || "").trim();
  if (!rawUrl) throw new Error("url est obligatoire");
  const url = await normalizeWatchSourceUrl(supabase, rawUrl);

  const { data: existingRows, error: findError } = await supabase
    .from("watch_sources")
    .select("*")
    .eq("url", url)
    .limit(1);
  if (findError) throw new Error(findError.message);
  const existing = (existingRows as Array<Record<string, unknown>> | null)?.[0];
  if (existing) {
    await audit(`propose_watch_source refusé (doublon) : ${name.slice(0, 120)}`);
    return JSON.stringify({
      saved: false,
      reason: "duplicate",
      existing,
      hint: "Cette URL est déjà dans le registre des sources. Utiliser update_watch_source pour la modifier.",
    });
  }

  const row: Record<string, unknown> = {
    expert,
    name: name.slice(0, 300),
    type,
    language,
    url,
    status: "proposed",
    theme: (input.theme || "").slice(0, 160),
    why: input.why || "",
    how_to_follow: input.how_to_follow || "",
  };
  if (input.proposed_by) row.proposed_by = String(input.proposed_by).slice(0, 120);

  await audit(`propose_watch_source : ${name.slice(0, 120)} (${url})`);

  const { data: created, error } = await supabase
    .from("watch_sources")
    .insert(row)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  return JSON.stringify({
    saved: true,
    source: created,
    hint: "Source proposée dans le registre (statut « proposed »). Elle passe en « followed » après validation humaine dans l'onglet Sources du module Veille.",
  });
}

/** Met à jour une source, repérée par id ou par url. */
export async function updateWatchSource(
  supabase: Supabase,
  input: WatchSourceUpdateInput,
  audit: AuditFn,
): Promise<string> {
  const patch: Record<string, unknown> = {};
  if (input.status !== undefined) patch.status = checkEnum(String(input.status), WATCH_SOURCE_STATUSES, "status");
  if (input.usefulness !== undefined) {
    const u = Number(input.usefulness);
    if (!Number.isInteger(u) || u < 1 || u > 5) throw new Error("usefulness doit être un entier entre 1 et 5");
    patch.usefulness = u;
  }
  if (input.notes !== undefined) patch.notes = String(input.notes);
  if (input.theme !== undefined) patch.theme = String(input.theme).slice(0, 160);
  if (input.last_useful_at !== undefined) patch.last_useful_at = String(input.last_useful_at);
  if (input.items_count !== undefined) {
    const n = Number(input.items_count);
    if (!Number.isInteger(n) || n < 0) throw new Error("items_count doit être un entier positif ou nul");
    patch.items_count = n;
  }
  if (Object.keys(patch).length === 0) throw new Error("Aucun champ à modifier");

  let locator;
  if (input.id) {
    locator = { column: "id", value: String(input.id) };
  } else if (input.url) {
    locator = { column: "url", value: await normalizeWatchSourceUrl(supabase, String(input.url)) };
  } else {
    throw new Error("Fournir id ou url pour repérer la source");
  }

  await audit(`update_watch_source (${locator.column}=${locator.value}) : ${Object.keys(patch).join(", ")}`);

  const { data, error } = await supabase
    .from("watch_sources")
    .update(patch)
    .eq(locator.column, locator.value)
    .select("*");
  if (error) throw new Error(error.message);
  const updated = (data as Array<Record<string, unknown>> | null) ?? [];
  if (updated.length === 0) throw new Error(`Aucune source trouvée pour ${locator.column}=${locator.value}`);

  return JSON.stringify({ saved: true, source: updated[0] });
}
