/**
 * Feature usage tracking service.
 *
 * Batches usage events and flushes them to Supabase periodically
 * or when the page is about to unload. Designed to have minimal
 * impact on app performance.
 */
import { supabase } from "@/integrations/supabase/client";

interface UsageEvent {
  user_id: string;
  feature_name: string;
  feature_category: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

const BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 30_000; // 30 seconds

let queue: UsageEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

async function flush() {
  if (queue.length === 0) return;

  const batch = queue.splice(0);
  try {
    await (supabase as unknown as { from: (table: string) => ReturnType<typeof supabase.from> }).from("feature_usage").insert(batch);
  } catch {
    // Re-queue on failure so events aren't lost
    queue.unshift(...batch);
  }
}

function ensureTimer() {
  if (flushTimer) return;
  flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);

  if (typeof window !== "undefined") {
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
    window.addEventListener("beforeunload", flush);
  }
}

/**
 * Queue a feature usage event for the given user.
 * Events are batched and sent periodically to minimize network overhead.
 */
export function trackFeatureUsage(
  userId: string,
  featureName: string,
  featureCategory: string,
  metadata?: Record<string, unknown>,
) {
  ensureTimer();

  queue.push({
    user_id: userId,
    feature_name: featureName,
    feature_category: featureCategory,
    metadata,
    created_at: new Date().toISOString(),
  });

  if (queue.length >= BATCH_SIZE) {
    flush();
  }
}
