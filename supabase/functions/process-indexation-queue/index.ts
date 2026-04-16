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
 * Called automatically by pg_net from the enqueue_indexation() trigger,
 * or manually from the admin settings UI as a fallback when pg_net is
 * unavailable.
 *
 * Behaviour: loops over batches of `BATCH_SIZE` items until the queue is
 * empty OR a soft time budget is consumed (`MAX_WALL_MS`). This way, on
 * a backlogged queue, one HTTP call drains thousands of items rather
 * than 50 at a time.
 *
 * For each unique (source_type, source_id), calls the `index-documents`
 * function internally, then marks the related queue rows as processed.
 * `delete` operations remove embeddings directly. Processed items older
 * than 7 days are purged.
 */

const BATCH_SIZE = 50;
// Edge functions cap at ~60s; leave a safety margin so we always answer.
const MAX_WALL_MS = 50_000;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getSupabaseClient();
    const startedAt = Date.now();
    let totalQueueItems = 0;
    let totalDeduplicated = 0;
    let totalProcessed = 0;
    let totalErrors = 0;
    let batches = 0;
    let drained = false;

    while (Date.now() - startedAt < MAX_WALL_MS) {
      // Fetch the next batch of pending items
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
        drained = true;
        break;
      }

      batches++;
      totalQueueItems += items.length;

      // Group by source_type + source_id to deduplicate
      const dedupMap = new Map<string, { source_type: string; source_id: string; operation: string; ids: string[] }>();
      for (const item of items) {
        const key = `${item.source_type}:${item.source_id}`;
        const existing = dedupMap.get(key);
        if (existing) {
          existing.ids.push(item.id);
          // Last operation in chronological order wins (items ordered ASC)
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
      totalDeduplicated += dedupMap.size;

      for (const entry of dedupMap.values()) {
        try {
          if (entry.operation === "delete") {
            await supabase
              .from("document_embeddings")
              .delete()
              .eq("source_type", entry.source_type)
              .eq("source_id", entry.source_id);
          } else {
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
              totalErrors++;
              continue;
            }
          }

          await supabase
            .from("indexation_queue")
            .update({ processed_at: new Date().toISOString() })
            .in("id", entry.ids);

          totalProcessed++;
        } catch (e) {
          console.error(`Error processing ${entry.source_type}/${entry.source_id}:`, e);
          totalErrors++;
        }
      }

      // If the batch came back partial, the queue is empty.
      if (items.length < BATCH_SIZE) {
        drained = true;
        break;
      }
    }

    // Cleanup: purge processed items older than 7 days (best-effort).
    const { error: cleanupError } = await supabase
      .from("indexation_queue")
      .delete()
      .not("processed_at", "is", null)
      .lt("processed_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
    if (cleanupError) console.warn("Queue cleanup error:", cleanupError.message);

    return createJsonResponse({
      queue_items: totalQueueItems,
      deduplicated: totalDeduplicated,
      processed: totalProcessed,
      errors: totalErrors,
      batches,
      drained,
      duration_ms: Date.now() - startedAt,
    });
  } catch (error: unknown) {
    console.error("Process indexation queue error:", error);
    const msg = error instanceof Error ? error.message : "Erreur interne";
    return createErrorResponse(msg);
  }
});
