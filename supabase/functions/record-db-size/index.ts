/**
 * Record DB Size Snapshot
 *
 * Called daily by a cron job. Queries pg_database_size via the get_db_size()
 * SQL function and stores the result in db_size_snapshots.
 *
 * Can also be called manually from the Monitoring admin page.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";
import {
  corsHeaders,
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
} from "../_shared/cors.ts";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getSupabaseClient();

    // Call the get_db_size() SQL function
    const { data: sizeData, error: sizeError } = await supabase.rpc("get_db_size");

    if (sizeError) {
      console.error("Error calling get_db_size:", sizeError);
      return createErrorResponse(`Failed to get DB size: ${sizeError.message}`);
    }

    const totalSizeBytes = sizeData?.total_size_bytes || 0;
    const tableSizes = sizeData?.table_sizes || {};

    const today = new Date().toISOString().split("T")[0];

    // Upsert (update if today's snapshot already exists)
    const { error: upsertError } = await supabase
      .from("db_size_snapshots")
      .upsert(
        {
          snapshot_date: today,
          total_size_bytes: totalSizeBytes,
          table_sizes: tableSizes,
        },
        { onConflict: "snapshot_date" }
      );

    if (upsertError) {
      console.error("Error upserting snapshot:", upsertError);
      return createErrorResponse(`Failed to save snapshot: ${upsertError.message}`);
    }

    return createJsonResponse({
      success: true,
      snapshot_date: today,
      total_size_bytes: totalSizeBytes,
      table_count: Object.keys(tableSizes).length,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("record-db-size error:", errorMessage);
    return createErrorResponse(errorMessage);
  }
});
