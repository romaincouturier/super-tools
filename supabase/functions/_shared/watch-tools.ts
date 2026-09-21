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
