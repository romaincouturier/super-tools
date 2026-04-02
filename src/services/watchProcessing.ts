import { supabase } from "@/integrations/supabase/client";
import type { WatchContentType } from "@/hooks/useWatch";

/**
 * Process a newly added watch item through the relevant pipeline:
 * - AI title & tags extraction
 * - URL scraping
 * - Image OCR
 * - Audio transcription
 * - Duplicate detection
 * - Clustering check
 */
export async function processWatchItem(itemId: string): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke("watch-process-item", {
      body: { item_id: itemId },
    });
    if (error) {
      console.error("[Watch] Processing error:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[Watch] Failed to process item:", itemId, e);
    return false;
  }
}

/** Detect content type from input */
export function detectContentType(input: string): WatchContentType {
  if (!input) return "text";

  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return "url";
    }
  } catch {
    // not a URL
  }

  return "text";
}

/** Check for potential duplicates before saving */
export async function checkDuplicates(body: string, title: string): Promise<{ isDuplicate: boolean; duplicateId: string | null; similarTitle: string | null }> {
  try {
    const { data } = await supabase.functions.invoke("watch-check-duplicate", {
      body: { body, title },
    });

    if (data?.is_duplicate) {
      return {
        isDuplicate: true,
        duplicateId: data.duplicate_id,
        similarTitle: data.similar_title,
      };
    }
  } catch {
    console.warn("[Watch] Duplicate check failed");
  }

  return { isDuplicate: false, duplicateId: null, similarTitle: null };
}

/** Trigger the weekly digest generation */
export async function triggerWeeklyDigest() {
  try {
    await supabase.functions.invoke("watch-weekly-digest");
  } catch {
    console.warn("[Watch] Failed to trigger weekly digest");
  }
}

/** Trigger cluster analysis */
export async function triggerClusterAnalysis() {
  try {
    await supabase.functions.invoke("watch-cluster-analysis");
  } catch {
    console.warn("[Watch] Failed to trigger cluster analysis");
  }
}
