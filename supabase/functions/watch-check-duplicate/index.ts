import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSupabaseClient,
  verifyAuth,
} from "../_shared/mod.ts";

/**
 * Check if a new watch item is a potential duplicate of an existing one.
 * Uses embedding similarity if available, falls back to text matching.
 */
serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const authResult = await verifyAuth(req.headers.get("Authorization"));
    if (!authResult) return createErrorResponse("Non autorisé", 401);

    const { body, title } = await req.json();
    if (!body && !title) {
      return createJsonResponse({ is_duplicate: false });
    }

    const supabase = getSupabaseClient();
    const searchText = (title || "") + " " + (body || "");

    // Simple text-based duplicate detection: check for very similar titles
    if (title) {
      const { data: titleMatches } = await supabase
        .from("watch_items")
        .select("id, title")
        .ilike("title", `%${title.slice(0, 60)}%`)
        .limit(1);

      if (titleMatches && titleMatches.length > 0) {
        return createJsonResponse({
          is_duplicate: true,
          duplicate_id: titleMatches[0].id,
          similar_title: titleMatches[0].title,
        });
      }
    }

    // Check for URL duplicates
    if (body && (body.startsWith("http://") || body.startsWith("https://"))) {
      const { data: urlMatches } = await supabase
        .from("watch_items")
        .select("id, title")
        .eq("source_url", body.trim())
        .limit(1);

      if (urlMatches && urlMatches.length > 0) {
        return createJsonResponse({
          is_duplicate: true,
          duplicate_id: urlMatches[0].id,
          similar_title: urlMatches[0].title,
        });
      }
    }

    // Embedding-based similarity check
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (OPENAI_API_KEY && searchText.length > 20) {
      try {
        const embRes = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "text-embedding-3-small",
            input: searchText.slice(0, 8000),
          }),
        });

        if (embRes.ok) {
          const embData = await embRes.json();
          const embedding = embData.data?.[0]?.embedding;

          if (embedding) {
            // Use pgvector to find similar items (cosine similarity > 0.92)
            const { data: similar } = await supabase.rpc("match_watch_items", {
              query_embedding: JSON.stringify(embedding),
              match_threshold: 0.92,
              match_count: 1,
            });

            if (similar && similar.length > 0) {
              return createJsonResponse({
                is_duplicate: true,
                duplicate_id: similar[0].id,
                similar_title: similar[0].title,
              });
            }
          }
        }
      } catch (e) {
        console.warn("Embedding duplicate check failed:", e);
      }
    }

    return createJsonResponse({ is_duplicate: false });
  } catch (error: unknown) {
    console.error("Error checking duplicate:", error);
    return createJsonResponse({ is_duplicate: false });
  }
});
