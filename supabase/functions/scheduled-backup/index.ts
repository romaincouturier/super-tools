/**
 * Scheduled Backup
 *
 * Called daily by an external cron service. Checks if automatic backups are
 * enabled in app_settings, exports all tables to JSON, uploads to Google Drive,
 * manages retention (keeps last N backups), and sends an email report on
 * success or failure.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
} from "../_shared/cors.ts";
import { sendEmail } from "../_shared/resend.ts";
import { getSenderEmail } from "../_shared/email-settings.ts";

// All tables to backup (same list as backup-export)
const TABLES_TO_BACKUP = [
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
  "formation_configs",
  "formation_dates",
  "formation_formulas",
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
  "trainers",
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
  "content_columns",
  "content_reviews",
  "content_notifications",
  "review_comments",
  "newsletter_cards",
  "newsletters",
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
  "events",
  "event_shares",
  "event_media",
  "missions",
  "mission_actions",
  "mission_activities",
  "mission_contacts",
  "mission_documents",
  "mission_media",
  "mission_page_templates",
  "mission_pages",
  "okr_objectives",
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

const MAX_BACKUPS_TO_KEEP = 14; // 2 weeks of daily backups

// ─── Google Drive helpers ───────────────────────────────────────────────────

async function refreshGoogleAccessToken(refreshToken: string): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Google OAuth credentials not configured");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh Google access token: ${errorText}`);
  }

  return (await response.json()).access_token;
}

async function uploadToGoogleDrive(
  accessToken: string,
  fileName: string,
  content: string,
  folderId?: string,
): Promise<{ id: string; name: string }> {
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
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Drive upload failed (${response.status}): ${errorText}`);
  }

  return await response.json();
}

async function listBackupsInFolder(
  accessToken: string,
  folderId: string,
): Promise<{ id: string; name: string; createdTime: string }[]> {
  const query = `'${folderId}' in parents and name contains 'supertools_backup_' and trashed = false`;
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=createdTime desc&fields=files(id,name,createdTime)&pageSize=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.ok) return [];
  const data = await response.json();
  return data.files || [];
}

async function deleteGoogleDriveFile(accessToken: string, fileId: string): Promise<void> {
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// ─── Main handler ───────────────────────────────────────────────────────────

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  const startTime = Date.now();

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Check if auto-backup is enabled ──
    const { data: enabledSetting } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "backup_enabled")
      .single();

    if (enabledSetting?.setting_value !== "true") {
      console.log("[scheduled-backup] Auto-backup is disabled, skipping.");
      return createJsonResponse({ skipped: true, reason: "backup_disabled" });
    }

    console.log("[scheduled-backup] Starting automatic backup...");

    // ── Export all tables ──
    const backup: Record<string, unknown[]> = {};
    const errors: string[] = [];
    let totalRows = 0;

    for (const tableName of TABLES_TO_BACKUP) {
      try {
        const { data, error } = await supabase.from(tableName).select("*");
        if (error) {
          errors.push(`${tableName}: ${error.message}`);
          backup[tableName] = [];
        } else {
          backup[tableName] = data || [];
          totalRows += (data || []).length;
        }
      } catch (err) {
        errors.push(`${tableName}: ${err instanceof Error ? err.message : "Unknown error"}`);
        backup[tableName] = [];
      }
    }

    const backupData = {
      exportedAt: new Date().toISOString(),
      version: "1.0",
      source: "scheduled-backup",
      tables: backup,
      errors: errors.length > 0 ? errors : undefined,
    };

    const backupJson = JSON.stringify(backupData, null, 2);
    const today = new Date().toISOString().split("T")[0];
    const fileName = `supertools_backup_${today}_${Date.now()}.json`;
    const backupSizeBytes = new TextEncoder().encode(backupJson).length;
    const backupSizeMB = (backupSizeBytes / 1024 / 1024).toFixed(2);

    console.log(`[scheduled-backup] Exported ${TABLES_TO_BACKUP.length} tables, ${totalRows} rows, ${backupSizeMB} MB`);

    // ── Upload to Google Drive ──
    let googleDriveResult: { id: string; name: string } | null = null;
    let deletedOldBackups = 0;

    // Find first user with Google Drive tokens
    const { data: tokenRow } = await supabase
      .from("google_drive_tokens")
      .select("*")
      .limit(1)
      .single();

    if (!tokenRow) {
      errors.push("Aucun compte Google Drive connecté");
    } else {
      const accessToken = await refreshGoogleAccessToken(tokenRow.refresh_token);

      // Update token in DB
      await supabase
        .from("google_drive_tokens")
        .update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", tokenRow.user_id);

      // Get folder ID from settings
      const { data: folderSetting } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "backup_gdrive_folder_id")
        .single();

      const folderId = folderSetting?.setting_value || undefined;

      // Upload
      googleDriveResult = await uploadToGoogleDrive(accessToken, fileName, backupJson, folderId);
      console.log("[scheduled-backup] Uploaded to Google Drive:", googleDriveResult.id);

      // ── Retention: delete old backups ──
      if (folderId) {
        const existingBackups = await listBackupsInFolder(accessToken, folderId);
        if (existingBackups.length > MAX_BACKUPS_TO_KEEP) {
          const toDelete = existingBackups.slice(MAX_BACKUPS_TO_KEEP);
          for (const file of toDelete) {
            try {
              await deleteGoogleDriveFile(accessToken, file.id);
              deletedOldBackups++;
              console.log(`[scheduled-backup] Deleted old backup: ${file.name}`);
            } catch (delErr) {
              console.warn(`[scheduled-backup] Failed to delete ${file.name}:`, delErr);
            }
          }
        }
      }
    }

    const durationMs = Date.now() - startTime;
    const success = errors.length === 0 && googleDriveResult !== null;

    // ── Log activity ──
    await supabase.from("activity_logs").insert({
      action_type: "scheduled_backup",
      recipient_email: "system",
      details: {
        success,
        fileName,
        tablesCount: TABLES_TO_BACKUP.length,
        totalRows,
        backupSizeMB,
        googleDriveFileId: googleDriveResult?.id || null,
        deletedOldBackups,
        durationMs,
        errors: errors.length > 0 ? errors : null,
      },
    });

    // ── Send email notification ──
    const adminEmail = await getSenderEmail();
    const statusEmoji = success ? "✅" : "⚠️";
    const statusText = success ? "réussie" : "avec des erreurs";

    await sendEmail({
      to: adminEmail,
      subject: `${statusEmoji} Sauvegarde SuperTools ${today} ${statusText}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${success ? '#16a34a' : '#dc2626'};">
            Sauvegarde automatique ${statusText}
          </h2>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Date</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${today}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Tables</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${TABLES_TO_BACKUP.length}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Lignes</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${totalRows.toLocaleString("fr-FR")}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Taille</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${backupSizeMB} Mo</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Durée</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${(durationMs / 1000).toFixed(1)}s</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Google Drive</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${googleDriveResult ? `✅ ${googleDriveResult.id}` : "❌ Non uploadé"}</td></tr>
            ${deletedOldBackups > 0 ? `<tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Anciennes sauvegardes supprimées</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${deletedOldBackups}</td></tr>` : ""}
          </table>
          ${errors.length > 0 ? `
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin-top: 16px;">
              <h3 style="color: #dc2626; margin: 0 0 8px 0;">Erreurs (${errors.length})</h3>
              <ul style="margin: 0; padding-left: 20px; color: #991b1b;">
                ${errors.map((e) => `<li style="margin-bottom: 4px;">${e}</li>`).join("")}
              </ul>
            </div>
          ` : ""}
          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
            Sauvegarde automatique SuperTools — Rétention : ${MAX_BACKUPS_TO_KEEP} jours
          </p>
        </div>
      `,
      _emailType: "scheduled_backup",
    });

    return createJsonResponse({
      success,
      fileName,
      tablesCount: TABLES_TO_BACKUP.length,
      totalRows,
      backupSizeMB,
      googleDrive: googleDriveResult,
      deletedOldBackups,
      durationMs,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[scheduled-backup] Fatal error:", errorMessage);

    // Try to send failure notification
    try {
      const adminEmail = await getSenderEmail();
      await sendEmail({
        to: adminEmail,
        subject: `❌ ÉCHEC sauvegarde SuperTools ${new Date().toISOString().split("T")[0]}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">Échec de la sauvegarde automatique</h2>
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px;">
              <p style="margin: 0; color: #991b1b;"><strong>Erreur :</strong> ${errorMessage}</p>
            </div>
            <p style="margin-top: 16px; color: #6b7280;">
              Vérifiez la configuration Google Drive et les paramètres de sauvegarde dans SuperTools.
            </p>
          </div>
        `,
        _emailType: "scheduled_backup_failure",
      });
    } catch (emailErr) {
      console.error("[scheduled-backup] Could not send failure notification:", emailErr);
    }

    return createErrorResponse(errorMessage);
  }
});
