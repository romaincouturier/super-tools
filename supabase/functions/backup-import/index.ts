import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSenderEmail } from "../_shared/email-settings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tables that should be cleared and restored (order matters for foreign keys)
// Dependent tables are deleted first (reverse order), then inserted in this order.
const TABLES_RESTORE_ORDER = [
  // ── Independent / config tables ──
  "app_settings",
  "ai_brand_settings",
  "email_templates",
  "email_snippets",
  "profiles",
  "user_module_access",
  "user_security_metadata",
  "user_preferences",
  "api_keys",
  "google_drive_tokens",
  "google_calendar_tokens",
  "program_files",

  // ── Formation catalog ──
  "formation_configs",
  "formation_dates",
  "formation_formulas",

  // ── Trainers (before trainings) ──
  "trainers",

  // ── Trainings ──
  "trainings",

  // ── Content columns (before cards) ──
  "content_columns",

  // ── CRM independent ──
  "crm_columns",
  "crm_tags",
  "crm_settings",
  "crm_revenue_targets",

  // ── Events ──
  "events",

  // ── Missions ──
  "missions",

  // ── OKR ──
  "okr_objectives",

  // ── Newsletters ──
  "newsletters",

  // ── Dependent tables ──
  "training_participants",
  "training_schedules",
  "training_actions",
  "training_evaluations",
  "training_documents",
  "training_media",
  "training_live_meetings",
  "training_coaching_slots",
  "participant_files",
  "scheduled_emails",
  "attendance_signatures",
  "convention_signatures",
  "devis_signatures",

  "trainer_evaluations",
  "trainer_training_adequacy",
  "trainer_attendance_signatures",
  "trainer_documents",

  "questionnaire_besoins",
  "questionnaire_events",
  "evaluation_analyses",
  "post_evaluation_emails",
  "sponsor_cold_evaluations",
  "stakeholder_appreciations",
  "session_start_notifications",

  "content_cards",
  "content_reviews",
  "content_notifications",
  "review_comments",
  "newsletter_cards",

  "crm_cards",
  "crm_card_tags",
  "crm_card_emails",
  "crm_comments",
  "crm_attachments",
  "crm_activity_log",

  "event_shares",
  "event_media",

  "mission_actions",
  "mission_activities",
  "mission_contacts",
  "mission_documents",
  "mission_media",
  "mission_page_templates",
  "mission_pages",

  "okr_key_results",
  "okr_initiatives",
  "okr_check_ins",
  "okr_participants",

  "daily_actions",
  "daily_action_analytics",

  "improvements",
  "reclamations",
  "media",
  "inbound_emails",
  "chatbot_conversations",
  "chatbot_knowledge_base",
  "commercial_coach_contexts",
  "woocommerce_coupons",
  "activity_logs",
  "failed_emails",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[backup-import] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Restore failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
