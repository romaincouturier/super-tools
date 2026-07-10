import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/supabase-client.ts";
// List of all tables to backup
const TABLES_TO_BACKUP = [
  "activity_logs",
  "admin_documents",
  "agent_conversations",
  "agent_feedback",
  "agent_query_audit_log",
  "agent_schema_registry",
  "ai_brand_settings",
  "api_keys",
  "api_request_logs",
  "app_settings",
  "attendance_signatures",
  "balance_sheets",
  "billing_plans",
  "book_albums",
  "book_analytics_events",
  "book_productions",
  "book_profiles",
  "book_share_links",
  "bpf_reports",
  "breakeven_scenarios",
  "cashflow_forecast",
  "chatbot_conversations",
  "chatbot_knowledge_base",
  "checklist_template_items",
  "checklist_templates",
  "coaching_bookings",
  "coaching_summaries",
  "commercial_coach_contexts",
  "community_read_state",
  "content_cards",
  "content_columns",
  "content_notifications",
  "content_reviews",
  "convention_signatures",
  "crm_activity_log",
  "crm_attachments",
  "crm_card_emails",
  "crm_card_tags",
  "crm_card_transcripts",
  "crm_cards",
  "crm_columns",
  "crm_comments",
  "crm_revenue_targets",
  "crm_scheduled_emails",
  "crm_settings",
  "crm_tags",
  "daily_action_analytics",
  "daily_actions",
  "db_size_snapshots",
  "devis_signatures",
  "document_embeddings",
  "edge_function_health",
  "editorial_recommendations",
  "editorial_theme_sources",
  "editorial_themes",
  "email_snippets",
  "email_templates",
  "evaluation_analyses",
  "event_media",
  "event_shares",
  "events",
  "failed_emails",
  "faq_items",
  "feature_usage",
  "formation_configs",
  "formation_dates",
  "formation_formulas",
  "game_authors",
  "game_expenses",
  "game_sales",
  "games",
  "google_calendar_tokens",
  "google_drive_tokens",
  "google_tokens",
  "group_matching_configs",
  "group_matching_groups",
  "group_matching_members",
  "group_matching_registrations",
  "idea_votes",
  "ideas",
  "improvements",
  "inbound_emails",
  "learner_magic_links",
  "learner_notifications",
  "learner_profiles",
  "lms_assignment_submissions",
  "lms_assignments",
  "lms_badge_awards",
  "lms_badges",
  "lms_course_folders",
  "lms_courses",
  "lms_deposit_comments",
  "lms_deposit_feedback",
  "lms_deposit_reactions",
  "lms_enrollments",
  "lms_forum_posts",
  "lms_forums",
  "lms_lesson_blocks",
  "lms_lesson_comments",
  "lms_lessons",
  "lms_messages",
  "lms_modules",
  "lms_page_views",
  "lms_progress",
  "lms_quiz_attempts",
  "lms_quiz_questions",
  "lms_quizzes",
  "lms_submissions",
  "lms_user_badges",
  "lms_work_deposits",
  "location_contract_signatures",
  "login_attempts",
  "logistics_checklist_items",
  "media",
  "mission_actions",
  "mission_activities",
  "mission_contacts",
  "mission_credits",
  "mission_documents",
  "mission_email_drafts",
  "mission_media",
  "mission_page_templates",
  "mission_pages",
  "mission_survey_answers",
  "mission_survey_questions",
  "mission_survey_responses",
  "mission_surveys",
  "missions",
  "monthly_reports",
  "network_actions",
  "network_contacts",
  "network_conversation",
  "network_interactions",
  "newsletter_cards",
  "newsletter_comments",
  "newsletters",
  "okr_check_ins",
  "okr_initiatives",
  "okr_key_results",
  "okr_objectives",
  "okr_participants",
  "okr_scheduled_emails",
  "order_email_log",
  "order_items",
  "org_members",
  "organizations",
  "participant_files",
  "partner_access_tokens",
  "partner_payments",
  "pictodico_challenges",
  "pictodico_words",
  "polling_cursors",
  "post_evaluation_emails",
  "practice_poll_options",
  "practice_poll_votes",
  "practice_polls",
  "practice_post_comments",
  "practice_post_hashtags",
  "practice_post_reactions",
  "practice_posts",
  "profiles",
  "program_files",
  "questionnaire_besoins",
  "questionnaire_events",
  "quote_settings",
  "quotes",
  "reclamations",
  "review_comments",
  "scheduled_emails",
  "sent_emails_log",
  "session_start_notifications",
  "sponsor_cold_evaluations",
  "stakeholder_appreciations",
  "subscriptions",
  "supertilt_actions",
  "supertilt_columns",
  "supertilt_settings",
  "support_ticket_attachments",
  "support_tickets",
  "testimonials",
  "time_entries",
  "trainer_attendance_signatures",
  "trainer_documents",
  "trainer_evaluations",
  "trainer_training_adequacy",
  "trainers",
  "training_actions",
  "training_coaching_slots",
  "training_documents",
  "training_evaluations",
  "training_formulas",
  "training_live_meetings",
  "training_media",
  "training_participants",
  "training_schedules",
  "training_support_imports",
  "training_support_media",
  "training_support_sections",
  "training_support_template_sections",
  "training_support_templates",
  "training_supports",
  "training_survey_answers",
  "training_survey_questions",
  "training_survey_recipients",
  "training_survey_responses",
  "training_surveys",
  "training_venues",
  "trainings",
  "transcript_ai_prompts",
  "transcript_generations",
  "transcripts",
  "usage_records",
  "user_module_access",
  "user_positioning",
  "user_preferences",
  "user_security_metadata",
  "watch_clusters",
  "watch_digests",
  "watch_items",
  "webhook_logs",
  "woocommerce_coupons",
  "woocommerce_orders",
  "woocommerce_pending_formations",
  "wp_articles",
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
    // Require authenticated admin caller
    const authedUser = await verifyAuth(req.headers.get("Authorization"));
    if (!authedUser) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: isAdminRow } = await supabase.rpc("is_admin", { _user_id: authedUser.id });
    if (!isAdminRow) {
      return new Response(JSON.stringify({ error: "Réservé aux administrateurs" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
