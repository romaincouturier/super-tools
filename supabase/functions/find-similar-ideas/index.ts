import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  verifyAuth,
} from "../_shared/mod.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";
import { embedText } from "../_shared/embeddings.ts";

/**
 * Anti-doublon à la saisie (lot 2) : embed la requête et renvoie les idées
 * les plus proches via le RPC match_ideas.
 * Appel : { query, excludeId?, limit? }
 */
Deno.serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return createErrorResponse("Method not allowed", 405);

  try {
    const authResult = await verifyAuth(req.headers.get("Authorization"));
    if (!authResult) return createErrorResponse("Non autorisé", 401);

    const { query, excludeId, limit } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length < 4) {
      return createJsonResponse({ matches: [] });
    }

    const embedding = await embedText(query);
    if (!embedding) return createJsonResponse({ matches: [] });

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("match_ideas", {
      query_embedding: embedding,
      match_count: Math.min(Number(limit) || 5, 10),
      exclude_id: excludeId ?? null,
    });
    if (error) throw error;

    // Ne garder que les correspondances réellement proches.
    const matches = ((data ?? []) as { id: string; title: string; status: string; similarity: number }[])
      .filter((m) => m.similarity >= 0.78);

    return createJsonResponse({ matches });
  } catch (err) {
    console.error("[find-similar-ideas] error", err);
    return createErrorResponse(err instanceof Error ? err.message : "Erreur inconnue", 500);
  }
});
