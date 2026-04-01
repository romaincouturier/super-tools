import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSupabaseClient,
} from "../_shared/mod.ts";

/**
 * Process pending indexation queue items.
 *
 * Called by pg_net from the enqueue_indexation() trigger after each data change.
 * NOT called from the frontend — no user auth required.
 * Authentication relies on the SERVICE_ROLE_KEY.
 *
 * For each pending item, calls the index-documents function internally,
 * then marks it as processed. For 'delete' operations, removes embeddings directly.
 * Also cleans up processed queue items older than 7 days.
 */

const BATCH_SIZE = 50;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getSupabaseClient();

    // Fetch pending items
    const { data: items, error: fetchError } = await supabase
      .from("indexation_queue")
      .select("*")
      .is("processed_at", null)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      return createErrorResponse(`Queue fetch error: ${fetchError.message}`);
    }

    if (!items || items.length === 0) {
      return createJsonResponse({ processed: 0, message: "Queue empty" });
    }

    let processed = 0;
    let errors = 0;

    // Group by source_type + source_id to deduplicate
    const dedupMap = new Map<string, { source_type: string; source_id: string; operation: string; ids: string[] }>();
    for (const item of items) {
      const key = `${item.source_type}:${item.source_id}`;
      const existing = dedupMap.get(key);
      if (existing) {
        existing.ids.push(item.id);
        // Last operation in chronological order wins (items ordered by created_at ASC)
        existing.operation = item.operation;
      } else {
        dedupMap.set(key, {
          source_type: item.source_type,
          source_id: item.source_id,
          operation: item.operation,
          ids: [item.id],
        });
      }
    }

    for (const entry of dedupMap.values()) {
      try {
        if (entry.operation === "delete") {
          // Remove embeddings for this source
          await supabase
            .from("document_embeddings")
            .delete()
            .eq("source_type", entry.source_type)
            .eq("source_id", entry.source_id);
        } else {
          // Call index-documents edge function
          const res = await fetch(`${SUPABASE_URL}/functions/v1/index-documents`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              source_type: entry.source_type,
              source_id: entry.source_id,
            }),
          });

          if (!res.ok) {
            console.error(`Index error for ${entry.source_type}/${entry.source_id}:`, await res.text());
            errors++;
            continue;
          }
        }

        // Mark all related queue items as processed
        await supabase
          .from("indexation_queue")
          .update({ processed_at: new Date().toISOString() })
          .in("id", entry.ids);

        processed++;
      } catch (e) {
        console.error(`Error processing ${entry.source_type}/${entry.source_id}:`, e);
        errors++;
      }
    }

    // Cleanup: purge processed items older than 7 days
    const { error: cleanupError } = await supabase
      .from("indexation_queue")
      .delete()
      .not("processed_at", "is", null)
      .lt("processed_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (cleanupError) {
      console.warn("Queue cleanup error:", cleanupError.message);
    }

    return createJsonResponse({
      queue_items: items.length,
      deduplicated: dedupMap.size,
      processed,
      errors,
    });
  } catch (error: unknown) {
    console.error("Process indexation queue error:", error);
    const msg = error instanceof Error ? error.message : "Erreur interne";
    return createErrorResponse(msg);
  }
});
