import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSenderEmail } from "../_shared/email-settings.ts";
import { corsHeaders, handleCorsPreflightIfNeeded, getCorsHeaders } from "../_shared/cors.ts";

// Tables that should be cleared and restored (order matters for foreign keys)
const TABLES_RESTORE_ORDER = [
  // Independent tables first
  "app_settings",
  "formation_configs",
  "formation_dates",
  "email_templates",
  "ai_brand_settings",
  "program_files",
  // Then tables with dependencies
  "trainings",
  "content_columns",
  "profiles",
  // Then dependent tables
  "training_participants",
  "training_schedules",
  "training_actions",
  "training_evaluations",
  "questionnaire_besoins",
  "questionnaire_events",
  "attendance_signatures",
  "evaluation_analyses",
  "improvements",
  "scheduled_emails",
  "content_cards",
  "content_reviews",
  "content_notifications",
  "review_comments",
  "activity_logs",
  // Auth-related (careful with these)
  "user_module_access",
  "user_security_metadata",
  "google_drive_tokens",
];

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Non autorisé");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify calling user is admin
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Non autorisé");
    }

    const adminEmail = await getSenderEmail();
    if (user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
      throw new Error("Seul l'administrateur peut restaurer des sauvegardes");
    }

    const { backupData, dryRun = true } = await req.json();

    if (!backupData || !backupData.tables) {
      throw new Error("Format de sauvegarde invalide");
    }

    console.log(`[backup-import] Starting ${dryRun ? "DRY RUN" : "RESTORE"} from backup dated ${backupData.exportedAt}`);

    const results: Record<string, { deleted: number; inserted: number; error?: string }> = {};

    for (const tableName of TABLES_RESTORE_ORDER) {
      const tableData = backupData.tables[tableName];
      
      if (!tableData) {
        console.log(`[backup-import] Skipping ${tableName}: not in backup`);
        continue;
      }

      try {
        if (dryRun) {
          // Dry run: just count what would be done
          const { count } = await supabase
            .from(tableName)
            .select("*", { count: "exact", head: true });

          results[tableName] = {
            deleted: count || 0,
            inserted: tableData.length,
          };
        } else {
          // Actual restore: delete then insert
          const { error: deleteError } = await supabase
            .from(tableName)
            .delete()
            .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

          if (deleteError) {
            console.error(`[backup-import] Error deleting ${tableName}:`, deleteError);
            results[tableName] = { deleted: 0, inserted: 0, error: deleteError.message };
            continue;
          }

          // Insert data in batches
          const batchSize = 100;
          let insertedCount = 0;

          for (let i = 0; i < tableData.length; i += batchSize) {
            const batch = tableData.slice(i, i + batchSize);
            const { error: insertError } = await supabase
              .from(tableName)
              .insert(batch);

            if (insertError) {
              console.error(`[backup-import] Error inserting into ${tableName}:`, insertError);
              results[tableName] = {
                deleted: 0,
                inserted: insertedCount,
                error: insertError.message,
              };
              break;
            }

            insertedCount += batch.length;
          }

          if (!results[tableName]?.error) {
            results[tableName] = {
              deleted: 0, // We don't know exact count
              inserted: insertedCount,
            };
          }

          console.log(`[backup-import] Restored ${tableName}: ${insertedCount} rows`);
        }
      } catch (err) {
        console.error(`[backup-import] Exception for ${tableName}:`, err);
        results[tableName] = {
          deleted: 0,
          inserted: 0,
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    }

    // Log restore activity
    if (!dryRun) {
      await supabase.from("activity_logs").insert({
        action_type: "backup_restored",
        recipient_email: "system",
        user_id: user.id,
        details: {
          backupDate: backupData.exportedAt,
          results,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        dryRun,
        backupDate: backupData.exportedAt,
        results,
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[backup-import] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Restore failed" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
