import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
// List of all tables to backup
const TABLES_TO_BACKUP = [
  // Core settings & config
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

  // Formation catalog
  "formation_configs",
  "formation_dates",
  "formation_formulas",

  // Trainings & related
  "trainings",
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

  // Trainers
  "trainers",
  "trainer_evaluations",
  "trainer_training_adequacy",
  "trainer_attendance_signatures",
  "trainer_documents",

  // Questionnaires & evaluations
  "questionnaire_besoins",
  "questionnaire_events",
  "evaluation_analyses",
  "post_evaluation_emails",
  "sponsor_cold_evaluations",
  "stakeholder_appreciations",
  "session_start_notifications",

  // Content management
  "content_cards",
  "content_columns",
  "content_reviews",
  "content_notifications",
  "review_comments",
  "newsletter_cards",
  "newsletters",

  // CRM
  "crm_columns",
  "crm_tags",
  "crm_settings",
  "crm_revenue_targets",
  "crm_cards",
  "crm_card_tags",
  "crm_card_emails",
  "crm_comments",
  "crm_attachments",
  "crm_activity_log",

  // Events
  "events",
  "event_shares",
  "event_media",

  // Missions
  "missions",
  "mission_actions",
  "mission_activities",
  "mission_contacts",
  "mission_documents",
  "mission_media",
  "mission_page_templates",
  "mission_pages",

  // OKR
  "okr_objectives",
  "okr_key_results",
  "okr_initiatives",
  "okr_check_ins",
  "okr_participants",

  // Daily actions
  "daily_actions",
  "daily_action_analytics",

  // Other
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

async function refreshGoogleAccessToken(refreshToken: string): Promise<string> {
  const GOOGLE_OAUTH_CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const GOOGLE_OAUTH_CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");

  if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET) {
    throw new Error("Google OAuth credentials not configured");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to refresh token:", errorText);
    throw new Error("Failed to refresh Google access token");
  }

  const data = await response.json();
  return data.access_token;
}

async function uploadToGoogleDrive(
  accessToken: string,
  fileName: string,
  content: string,
  folderId?: string
): Promise<{ id: string; name: string }> {
  // Create multipart request for file upload
  const boundary = "backup_boundary_" + Date.now();
  
  const metadata = {
    name: fileName,
    mimeType: "application/json",
    ...(folderId && { parents: [folderId] }),
  };

  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    "Content-Type: application/json",
    "",
    content,
    `--${boundary}--`,
  ].join("\r\n");

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Google Drive upload failed:", errorText);
    throw new Error(`Failed to upload to Google Drive: ${response.status}`);
  }

  return await response.json();
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get optional parameters
    const { uploadToGDrive = false, userId } = await req.json().catch(() => ({}));

    console.log("[backup-export] Starting backup of all tables...");

    // Export all tables
    const backup: Record<string, unknown[]> = {};
    const errors: string[] = [];

    for (const tableName of TABLES_TO_BACKUP) {
      try {
        const { data, error } = await supabase.from(tableName).select("*");
        
        if (error) {
          console.error(`[backup-export] Error exporting ${tableName}:`, error);
          errors.push(`${tableName}: ${error.message}`);
          backup[tableName] = [];
        } else {
          backup[tableName] = data || [];
          console.log(`[backup-export] Exported ${tableName}: ${(data || []).length} rows`);
        }
      } catch (err) {
        console.error(`[backup-export] Exception exporting ${tableName}:`, err);
        errors.push(`${tableName}: ${err instanceof Error ? err.message : "Unknown error"}`);
        backup[tableName] = [];
      }
    }

    // Create backup metadata
    const backupData = {
      exportedAt: new Date().toISOString(),
      version: "1.0",
      tables: backup,
      errors: errors.length > 0 ? errors : undefined,
    };

    const backupJson = JSON.stringify(backupData, null, 2);
    const fileName = `supertools_backup_${new Date().toISOString().split("T")[0]}_${Date.now()}.json`;

    let googleDriveResult = null;

    // Upload to Google Drive if requested
    if (uploadToGDrive && userId) {
      // Get Google Drive tokens
      const { data: tokenData, error: tokenError } = await supabase
        .from("google_drive_tokens")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (tokenError || !tokenData) {
        console.log("[backup-export] No Google Drive tokens found, skipping upload");
      } else {
        try {
          // Refresh access token
          const accessToken = await refreshGoogleAccessToken(tokenData.refresh_token);

          // Get backup folder ID from settings
          const { data: settings } = await supabase
            .from("app_settings")
            .select("setting_value")
            .eq("setting_key", "backup_gdrive_folder_id")
            .single();

          const folderId = settings?.setting_value || undefined;

          // Upload to Google Drive
          googleDriveResult = await uploadToGoogleDrive(
            accessToken,
            fileName,
            backupJson,
            folderId
          );

          console.log("[backup-export] Uploaded to Google Drive:", googleDriveResult);

          // Update token in database if refreshed
          await supabase
            .from("google_drive_tokens")
            .update({
              access_token: accessToken,
              token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);
        } catch (gdError) {
          console.error("[backup-export] Google Drive upload failed:", gdError);
          errors.push(`Google Drive: ${gdError instanceof Error ? gdError.message : "Upload failed"}`);
        }
      }
    }

    // Log backup activity
    await supabase.from("activity_logs").insert({
      action_type: "backup_created",
      recipient_email: "system",
      user_id: userId || null,
      details: {
        tablesCount: Object.keys(backup).length,
        totalRows: Object.values(backup).reduce((sum, rows) => sum + rows.length, 0),
        fileName,
        googleDrive: googleDriveResult ? { fileId: googleDriveResult.id } : null,
        errors: errors.length > 0 ? errors : null,
      },
    });

    // Return backup data or summary
    if (!uploadToGDrive) {
      // Return the actual backup for download
      return new Response(backupJson, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${fileName}"`,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        fileName,
        tablesCount: Object.keys(backup).length,
        totalRows: Object.values(backup).reduce((sum, rows) => sum + rows.length, 0),
        googleDrive: googleDriveResult,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[backup-export] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Backup failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
