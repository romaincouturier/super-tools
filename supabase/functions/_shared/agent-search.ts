/**
 * Recherche sémantique partagée (agent-chat, mcp-server).
 *
 * Embedding OpenAI avec cache (agent_embedding_cache), recherche hybride
 * match_documents_hybrid avec repli sur match_documents.
 */
import { getSupabaseClient } from "./supabase-client.ts";
import { getOpenAIApiKey } from "./api-keys.ts";
import { logEmbeddingUsage } from "./api-usage.ts";

type SupabaseClient = ReturnType<typeof getSupabaseClient>;

export interface SearchResult {
  source_type: unknown;
  title: unknown;
  date: unknown;
  content: string;
  similarity: number;
  metadata: unknown;
}

async function sha256(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getCachedEmbedding(
  supabase: SupabaseClient,
  queryText: string,
): Promise<number[] | null> {
  const hash = await sha256(queryText);
  const { data } = await supabase
    .from("agent_embedding_cache")
    .select("embedding")
    .eq("query_hash", hash)
    .single();
  if (data?.embedding) {
    return data.embedding as number[];
  }
  return null;
}

async function storeCachedEmbedding(
  supabase: SupabaseClient,
  queryText: string,
  embedding: number[],
): Promise<void> {
  const hash = await sha256(queryText);
  await supabase.from("agent_embedding_cache").upsert(
    {
      query_hash: hash,
      query_text: queryText.slice(0, 500),
      embedding,
    },
    { onConflict: "query_hash" },
  );
}

/**
 * Recherche dans les contenus indexés. Lève une Error en cas d'échec
 * (clé manquante, API embedding, RPC).
 */
export async function searchContent(
  supabase: SupabaseClient,
  query: string,
  sourceTypes?: string[],
  maxResults = 10,
  missionId?: string | null,
): Promise<SearchResult[]> {
  const openaiKey = await getOpenAIApiKey();
  if (!openaiKey) {
    throw new Error("OPENAI_API_KEY not configured for search");
  }

  let queryEmbedding = await getCachedEmbedding(supabase, query);

  if (!queryEmbedding) {
    const embRes = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: query,
      }),
    });

    if (!embRes.ok) {
      throw new Error(`Embedding API error: ${embRes.status}`);
    }

    const embData = await embRes.json();
    await logEmbeddingUsage({
      origin: "agent-search",
      model: "text-embedding-3-small",
      totalTokens: embData.usage?.total_tokens ?? 0,
      trigger: "user",
    });
    queryEmbedding = embData.data?.[0]?.embedding;
    if (!queryEmbedding) {
      throw new Error("Failed to generate query embedding");
    }

    storeCachedEmbedding(supabase, query, queryEmbedding).catch(() => {});
  }

  // Recherche hybride (RRF vecteur + plein texte + fraîcheur), avec
  // repli sur la recherche vectorielle si la migration n'est pas passée
  let { data, error } = await supabase.rpc("match_documents_hybrid", {
    query_text: query,
    query_embedding: JSON.stringify(queryEmbedding),
    match_count: maxResults,
    filter_source_types: sourceTypes || null,
    filter_mission_id: missionId || null,
  });

  if (error) {
    // Repli sur la recherche vectorielle simple si la fonction hybride n'est
    // pas déployée. Elle ne sait pas filtrer par mission : plutôt que de
    // renvoyer silencieusement des résultats hors périmètre, on échoue.
    if (missionId) {
      throw new Error(
        `Recherche par mission indisponible (match_documents_hybrid : ${error.message}). ` +
          `Relancer sans filtre mission ou appliquer la migration.`,
      );
    }
    ({ data, error } = await supabase.rpc("match_documents", {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: 0.65,
      match_count: maxResults,
      filter_source_types: sourceTypes || null,
    }));
  }

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((r: Record<string, unknown>) => ({
    source_type: r.source_type,
    title: r.source_title,
    date: r.source_date,
    content: (r.content as string)?.slice(0, 1000),
    similarity: Number((r.similarity as number).toFixed(3)),
    metadata: r.metadata,
  }));
}
