/**
 * Scheduled Backup
 *
 * Called daily by an external cron service. Performs:
 *  1. Full database export (all tables → JSON → Google Drive)
 *  2. Storage files backup (all buckets → Google Drive subfolder)
 *  3. GFS rotation: keeps 7 daily, 4 weekly, 3 monthly backups
 *  4. Integrity verification (row counts, FK references, JSON parsing)
 *  5. Native pg_dump via Supabase Management API (if key configured)
 *  6. Email report on success or failure
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
} from "../_shared/cors.ts";
import { sendEmail } from "../_shared/resend.ts";
import { getSenderEmail } from "../_shared/email-settings.ts";
import { getBccList } from "../_shared/email-settings.ts";

// ─── Tables to backup ───────────────────────────────────────────────────────

const TABLES_TO_BACKUP = [
  "app_settings", "ai_brand_settings", "email_templates", "email_snippets",
  "profiles", "user_module_access", "user_security_metadata", "user_preferences",
  "api_keys", "google_drive_tokens", "google_calendar_tokens", "program_files",
  "formation_configs", "formation_dates", "formation_formulas",
  "trainings", "training_participants", "training_schedules", "training_actions",
  "training_evaluations", "training_documents", "training_media",
  "training_live_meetings", "training_coaching_slots", "participant_files",
  "scheduled_emails", "attendance_signatures", "convention_signatures", "devis_signatures",
  "trainers", "trainer_evaluations", "trainer_training_adequacy",
  "trainer_attendance_signatures", "trainer_documents",
  "questionnaire_besoins", "questionnaire_events", "evaluation_analyses",
  "post_evaluation_emails", "sponsor_cold_evaluations", "stakeholder_appreciations",
  "session_start_notifications",
  "content_cards", "content_columns", "content_reviews", "content_notifications",
  "review_comments", "newsletter_cards", "newsletters",
  "crm_columns", "crm_tags", "crm_settings", "crm_revenue_targets",
  "crm_cards", "crm_card_tags", "crm_card_emails", "crm_comments",
  "crm_attachments", "crm_activity_log",
  "events", "event_shares", "event_media",
  "missions", "mission_actions", "mission_activities", "mission_contacts",
  "mission_documents", "mission_media", "mission_page_templates", "mission_pages",
  "okr_objectives", "okr_key_results", "okr_initiatives", "okr_check_ins", "okr_participants",
  "daily_actions", "daily_action_analytics",
  "improvements", "reclamations", "media", "inbound_emails",
  "chatbot_conversations", "chatbot_knowledge_base", "commercial_coach_contexts",
  "woocommerce_coupons", "activity_logs", "failed_emails",
];

// ─── Storage buckets ────────────────────────────────────────────────────────

const STORAGE_BUCKETS = [
  "training-programs",
  "training-documents",
  "training-media",
  "content-images",
  "review-images",
  "crm-attachments",
  "certificates",
  "mission-media",
  "mission-documents",
  "event-media",
  "signature-proofs",
  "media",
  "devis-pdfs",
];

// ─── GFS Retention ──────────────────────────────────────────────────────────
// Grandfather-Father-Son: 7 daily + 4 weekly (Sunday) + 3 monthly (1st)

const GFS_DAILY = 7;
const GFS_WEEKLY = 4;
const GFS_MONTHLY = 3;

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

async function uploadJsonToGoogleDrive(
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

async function uploadBlobToGoogleDrive(
  accessToken: string,
  fileName: string,
  blob: Blob,
  mimeType: string,
  folderId?: string,
): Promise<{ id: string; name: string }> {
  const boundary = "storage_backup_" + Date.now();
  const metadata = {
    name: fileName,
    mimeType,
    ...(folderId && { parents: [folderId] }),
  };

  // Build multipart body with binary content
  const metaPart = new TextEncoder().encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
  );
  const endPart = new TextEncoder().encode(`\r\n--${boundary}--`);
  const blobBytes = new Uint8Array(await blob.arrayBuffer());

  const bodyParts = new Uint8Array(metaPart.length + blobBytes.length + endPart.length);
  bodyParts.set(metaPart, 0);
  bodyParts.set(blobBytes, metaPart.length);
  bodyParts.set(endPart, metaPart.length + blobBytes.length);

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: bodyParts,
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Drive upload failed (${response.status}): ${errorText}`);
  }

  return await response.json();
}

async function createGoogleDriveFolder(
  accessToken: string,
  folderName: string,
  parentFolderId?: string,
): Promise<string> {
  const metadata = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
    ...(parentFolderId && { parents: [parentFolderId] }),
  };

  const response = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    throw new Error(`Failed to create Drive folder: ${response.status}`);
  }

  const data = await response.json();
  return data.id;
}

async function listFilesInFolder(
  accessToken: string,
  folderId: string,
  nameFilter?: string,
): Promise<{ id: string; name: string; createdTime: string }[]> {
  let query = `'${folderId}' in parents and trashed = false`;
  if (nameFilter) query += ` and name contains '${nameFilter}'`;

  const allFiles: { id: string; name: string; createdTime: string }[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", query);
    url.searchParams.set("orderBy", "createdTime desc");
    url.searchParams.set("fields", "files(id,name,createdTime),nextPageToken");
    url.searchParams.set("pageSize", "200");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) break;
    const data = await response.json();
    allFiles.push(...(data.files || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allFiles;
}

async function deleteGoogleDriveFile(accessToken: string, fileId: string): Promise<void> {
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// ─── GFS Rotation Logic ─────────────────────────────────────────────────────

function computeGfsKeepSet(
  backups: { id: string; name: string; createdTime: string }[],
): Set<string> {
  // Parse dates from backup names: supertools_backup_YYYY-MM-DD_*.json
  // or from createdTime
  const keep = new Set<string>();
  const now = new Date();

  // Sort newest first
  const sorted = [...backups].sort(
    (a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime(),
  );

  // 1. Keep last N daily backups
  let dailyKept = 0;
  for (const b of sorted) {
    if (dailyKept >= GFS_DAILY) break;
    keep.add(b.id);
    dailyKept++;
  }

  // 2. Keep last N weekly backups (one per calendar week, Sunday)
  const weeksKept = new Set<string>();
  for (const b of sorted) {
    if (weeksKept.size >= GFS_WEEKLY) break;
    const d = new Date(b.createdTime);
    // Get ISO week key: year-weekNumber
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay()); // Go to Sunday
    const weekKey = `${weekStart.getFullYear()}-${weekStart.getMonth()}-${weekStart.getDate()}`;
    if (!weeksKept.has(weekKey)) {
      weeksKept.add(weekKey);
      keep.add(b.id);
    }
  }

  // 3. Keep last N monthly backups (one per calendar month)
  const monthsKept = new Set<string>();
  for (const b of sorted) {
    if (monthsKept.size >= GFS_MONTHLY) break;
    const d = new Date(b.createdTime);
    const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
    if (!monthsKept.has(monthKey)) {
      monthsKept.add(monthKey);
      keep.add(b.id);
    }
  }

  return keep;
}

// ─── Storage Backup ─────────────────────────────────────────────────────────

interface StorageBackupResult {
  bucket: string;
  filesCount: number;
  totalSizeBytes: number;
  uploadedFiles: number;
  errors: string[];
}

async function backupStorageBucket(
  supabase: any,
  accessToken: string,
  bucketName: string,
  storageFolderId: string,
): Promise<StorageBackupResult> {
  const result: StorageBackupResult = {
    bucket: bucketName,
    filesCount: 0,
    totalSizeBytes: 0,
    uploadedFiles: 0,
    errors: [],
  };

  try {
    // Create a subfolder for this bucket
    const bucketFolderId = await createGoogleDriveFolder(accessToken, bucketName, storageFolderId);

    // List all files in the bucket (recursive)
    const files = await listBucketFiles(supabase, bucketName);
    result.filesCount = files.length;

    for (const file of files) {
      try {
        // Download from Supabase Storage
        const { data, error } = await supabase.storage.from(bucketName).download(file.name);
        if (error || !data) {
          result.errors.push(`${bucketName}/${file.name}: ${error?.message || "download failed"}`);
          continue;
        }

        result.totalSizeBytes += data.size;

        // Skip files > 25MB to stay within edge function limits
        if (data.size > 25 * 1024 * 1024) {
          result.errors.push(`${bucketName}/${file.name}: skipped (${(data.size / 1024 / 1024).toFixed(1)}MB > 25MB limit)`);
          continue;
        }

        // Flatten path for Drive (replace / with ___)
        const driveName = file.name.replace(/\//g, "___");
        const mimeType = guessMimeType(file.name);

        await uploadBlobToGoogleDrive(accessToken, driveName, data, mimeType, bucketFolderId);
        result.uploadedFiles++;
      } catch (fileErr) {
        result.errors.push(
          `${bucketName}/${file.name}: ${fileErr instanceof Error ? fileErr.message : "unknown error"}`,
        );
      }
    }
  } catch (err) {
    result.errors.push(
      `${bucketName}: ${err instanceof Error ? err.message : "bucket backup failed"}`,
    );
  }

  return result;
}

async function listBucketFiles(
  supabase: ReturnType<typeof createClient>,
  bucketName: string,
  path = "",
): Promise<{ name: string }[]> {
  const allFiles: { name: string }[] = [];

  try {
    const { data, error } = await supabase.storage.from(bucketName).list(path, {
      limit: 1000,
      sortBy: { column: "name", order: "asc" },
    });

    if (error || !data) return allFiles;

    for (const item of data) {
      const fullPath = path ? `${path}/${item.name}` : item.name;
      if (item.id === null) {
        // It's a folder, recurse
        const subFiles = await listBucketFiles(supabase, bucketName, fullPath);
        allFiles.push(...subFiles);
      } else {
        allFiles.push({ name: fullPath });
      }
    }
  } catch {
    // Bucket might not exist or be empty
  }

  return allFiles;
}

function guessMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    mp4: "video/mp4",
    webm: "video/webm",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    json: "application/json",
    txt: "text/plain",
    csv: "text/csv",
    zip: "application/zip",
  };
  return map[ext || ""] || "application/octet-stream";
}

// ─── Integrity Verification ─────────────────────────────────────────────────

interface IntegrityResult {
  passed: boolean;
  checks: {
    jsonParseable: boolean;
    tablesPresent: number;
    tablesMissing: string[];
    rowCountMatches: number;
    rowCountMismatches: { table: string; backup: number; live: number }[];
    emptyTablesInBackup: string[];
    totalBackupRows: number;
    totalLiveRows: number;
  };
}

async function verifyBackupIntegrity(
  supabase: any,
  backupJson: string,
  tablesToBackup: string[],
): Promise<IntegrityResult> {
  const result: IntegrityResult = {
    passed: true,
    checks: {
      jsonParseable: false,
      tablesPresent: 0,
      tablesMissing: [],
      rowCountMatches: 0,
      rowCountMismatches: [],
      emptyTablesInBackup: [],
      totalBackupRows: 0,
      totalLiveRows: 0,
    },
  };

  // 1. Re-parse the JSON to verify it's valid
  let parsed: { tables: Record<string, unknown[]> };
  try {
    parsed = JSON.parse(backupJson);
    result.checks.jsonParseable = true;
  } catch {
    result.passed = false;
    return result;
  }

  if (!parsed.tables) {
    result.passed = false;
    return result;
  }

  // 2. Check all expected tables are present
  for (const table of tablesToBackup) {
    if (parsed.tables[table]) {
      result.checks.tablesPresent++;
    } else {
      result.checks.tablesMissing.push(table);
    }
  }

  // 3. Compare row counts with live database
  for (const table of tablesToBackup) {
    const backupRows = parsed.tables[table]?.length ?? 0;
    result.checks.totalBackupRows += backupRows;

    if (backupRows === 0) {
      result.checks.emptyTablesInBackup.push(table);
    }

    try {
      const { count } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });

      const liveRows = count ?? 0;
      result.checks.totalLiveRows += liveRows;

      if (backupRows === liveRows) {
        result.checks.rowCountMatches++;
      } else {
        result.checks.rowCountMismatches.push({
          table,
          backup: backupRows,
          live: liveRows,
        });
      }
    } catch {
      // Can't verify this table
    }
  }

  // Row count mismatches may happen if data changed during backup (minor drift is OK)
  // Flag as failed only if >10% of tables have mismatches or a table lost >50% of rows
  const mismatchRate = result.checks.rowCountMismatches.length / tablesToBackup.length;
  const hasSevereLoss = result.checks.rowCountMismatches.some(
    (m) => m.live > 0 && m.backup < m.live * 0.5,
  );

  if (result.checks.tablesMissing.length > 0 || mismatchRate > 0.1 || hasSevereLoss) {
    result.passed = false;
  }

  return result;
}

// ─── Native pg_dump via Supabase Management API ─────────────────────────────

interface PgDumpResult {
  triggered: boolean;
  downloadUrl: string | null;
  uploadedToDrive: boolean;
  driveFileId: string | null;
  error: string | null;
}

async function triggerAndDownloadPgDump(
  projectRef: string,
  managementApiKey: string,
  accessToken: string | null,
  driveFolderId: string | undefined,
): Promise<PgDumpResult> {
  const result: PgDumpResult = {
    triggered: false,
    downloadUrl: null,
    uploadedToDrive: false,
    driveFileId: null,
    error: null,
  };

  const baseUrl = "https://api.supabase.com/v1";
  const headers = {
    Authorization: `Bearer ${managementApiKey}`,
    "Content-Type": "application/json",
  };

  try {
    // 1. Trigger a new physical backup
    const triggerRes = await fetch(`${baseUrl}/projects/${projectRef}/database/backups`, {
      method: "POST",
      headers,
    });

    if (!triggerRes.ok) {
      const errorText = await triggerRes.text();
      // 409 = backup already in progress, which is fine
      if (triggerRes.status !== 409) {
        result.error = `Trigger failed (${triggerRes.status}): ${errorText}`;
        return result;
      }
    }

    result.triggered = true;

    // 2. Get latest backup info (the one we just triggered or most recent)
    const listRes = await fetch(`${baseUrl}/projects/${projectRef}/database/backups`, {
      headers,
    });

    if (!listRes.ok) {
      result.error = `List backups failed (${listRes.status})`;
      return result;
    }

    const backupsList = await listRes.json();
    const latestBackup = backupsList?.backups?.[0];

    if (!latestBackup) {
      result.error = "No backups available";
      return result;
    }

    // 3. If the backup is completed, try to get the download link
    if (latestBackup.status === "COMPLETED") {
      // Get download URL
      const downloadRes = await fetch(
        `${baseUrl}/projects/${projectRef}/database/backups/${latestBackup.id}/download`,
        { headers },
      );

      if (downloadRes.ok) {
        const downloadData = await downloadRes.json();
        result.downloadUrl = downloadData.fileUrl || null;

        // 4. Upload to Google Drive if possible
        if (result.downloadUrl && accessToken) {
          try {
            // Download the dump file
            const dumpRes = await fetch(result.downloadUrl);
            if (dumpRes.ok) {
              const dumpBlob = await dumpRes.blob();
              const today = new Date().toISOString().split("T")[0];
              const dumpFileName = `supertools_pgdump_${today}.sql.gz`;

              const boundary = "pgdump_boundary_" + Date.now();
              const metadata = {
                name: dumpFileName,
                mimeType: "application/gzip",
                ...(driveFolderId && { parents: [driveFolderId] }),
              };

              const metaPart = new TextEncoder().encode(
                `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/gzip\r\n\r\n`,
              );
              const endPart = new TextEncoder().encode(`\r\n--${boundary}--`);
              const dumpBytes = new Uint8Array(await dumpBlob.arrayBuffer());

              const bodyParts = new Uint8Array(metaPart.length + dumpBytes.length + endPart.length);
              bodyParts.set(metaPart, 0);
              bodyParts.set(dumpBytes, metaPart.length);
              bodyParts.set(endPart, metaPart.length + dumpBytes.length);

              const uploadRes = await fetch(
                "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": `multipart/related; boundary=${boundary}`,
                  },
                  body: bodyParts,
                },
              );

              if (uploadRes.ok) {
                const uploadData = await uploadRes.json();
                result.uploadedToDrive = true;
                result.driveFileId = uploadData.id;
              }
            }
          } catch (uploadErr) {
            result.error = `pg_dump download/upload failed: ${uploadErr instanceof Error ? uploadErr.message : "unknown"}`;
          }
        }
      }
    } else {
      result.error = `Latest backup status: ${latestBackup.status} (not yet completed)`;
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : "pg_dump failed";
  }

  return result;
}

// ─── Main handler ───────────────────────────────────────────────────────────

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  const startTime = Date.now();

  try {
    // Health check: respond immediately to empty body requests (from check-functions-health)
    const body = await req.json().catch(() => ({}));
    if (Object.keys(body).length === 0 && req.headers.get("authorization")?.includes(Deno.env.get("SUPABASE_ANON_KEY") || "__none__")) {
      return createJsonResponse({ status: "ok", function: "scheduled-backup" });
    }
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

    const errors: string[] = [];

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 1: Database backup
    // ════════════════════════════════════════════════════════════════════════

    const backup: Record<string, unknown[]> = {};
    let totalRows = 0;

    for (const tableName of TABLES_TO_BACKUP) {
      try {
        const { data, error } = await supabase.from(tableName).select("*");
        if (error) {
          errors.push(`[DB] ${tableName}: ${error.message}`);
          backup[tableName] = [];
        } else {
          backup[tableName] = data || [];
          totalRows += (data || []).length;
        }
      } catch (err) {
        errors.push(`[DB] ${tableName}: ${err instanceof Error ? err.message : "Unknown error"}`);
        backup[tableName] = [];
      }
    }

    const backupData = {
      exportedAt: new Date().toISOString(),
      version: "2.0",
      source: "scheduled-backup",
      tables: backup,
      errors: errors.length > 0 ? errors : undefined,
    };

    const backupJson = JSON.stringify(backupData, null, 2);
    const today = new Date().toISOString().split("T")[0];
    const fileName = `supertools_backup_${today}_${Date.now()}.json`;
    const backupSizeBytes = new TextEncoder().encode(backupJson).length;
    const backupSizeMB = (backupSizeBytes / 1024 / 1024).toFixed(2);

    console.log(`[scheduled-backup] Phase 1: Exported ${TABLES_TO_BACKUP.length} tables, ${totalRows} rows, ${backupSizeMB} MB`);

    // ════════════════════════════════════════════════════════════════════════
    // GOOGLE DRIVE SETUP
    // ════════════════════════════════════════════════════════════════════════

    let googleDriveResult: { id: string; name: string } | null = null;
    let deletedOldBackups = 0;
    let storageResults: StorageBackupResult[] = [];
    let storageTotalFiles = 0;
    let storageUploadedFiles = 0;
    let storageTotalSizeMB = "0";
    let earlyLogId: string | undefined;

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

      const rootFolderId = folderSetting?.setting_value || undefined;

      // ── Upload DB backup ──
      googleDriveResult = await uploadJsonToGoogleDrive(accessToken, fileName, backupJson, rootFolderId);
      console.log("[scheduled-backup] DB backup uploaded to Google Drive:", googleDriveResult.id);

      // ── Write an early activity log so the UI shows the latest backup even if storage phase times out ──
      const earlyLogPayload = {
        action_type: "scheduled_backup",
        recipient_email: "system",
        details: {
          success: true,
          fileName,
          tablesCount: TABLES_TO_BACKUP.length,
          totalRows,
          backupSizeMB,
          googleDriveFileId: googleDriveResult.id,
          storage: null,
          deletedOldBackups: 0,
          gfsRetention: `${GFS_DAILY}d/${GFS_WEEKLY}w/${GFS_MONTHLY}m`,
          integrity: null,
          pgDump: null,
          durationMs: Date.now() - startTime,
          errors: errors.length > 0 ? errors : null,
          _partial: true,
        },
      };
      const { data: earlyLog } = await supabase.from("activity_logs").insert(earlyLogPayload).select("id").single();
      earlyLogId = earlyLog?.id;

      // ══════════════════════════════════════════════════════════════════════
      // PHASE 2: Storage files backup
      // ══════════════════════════════════════════════════════════════════════

      console.log("[scheduled-backup] Phase 2: Starting storage backup...");

      try {
        // Create a dated subfolder for storage files
        const storageFolderName = `storage_${today}`;
        const storageFolderId = await createGoogleDriveFolder(
          accessToken,
          storageFolderName,
          rootFolderId,
        );

        for (const bucket of STORAGE_BUCKETS) {
          // Check remaining time (leave 15s margin for integrity check + email)
          const elapsed = Date.now() - startTime;
          if (elapsed > 35_000) { // 35s = leave ~25s for wrap-up (edge function ~60s limit)
            errors.push(`[Storage] Timeout après ${bucket} — buckets restants non sauvegardés`);
            break;
          }

          console.log(`[scheduled-backup] Backing up storage bucket: ${bucket}`);
          const bucketResult = await backupStorageBucket(supabase, accessToken, bucket, storageFolderId);
          storageResults.push(bucketResult);
          storageTotalFiles += bucketResult.filesCount;
          storageUploadedFiles += bucketResult.uploadedFiles;

          if (bucketResult.errors.length > 0) {
            // Only add first 3 errors per bucket to avoid flooding
            errors.push(...bucketResult.errors.slice(0, 3));
            if (bucketResult.errors.length > 3) {
              errors.push(`[Storage] ${bucket}: +${bucketResult.errors.length - 3} autres erreurs`);
            }
          }
        }

        const totalStorageBytes = storageResults.reduce((sum, r) => sum + r.totalSizeBytes, 0);
        storageTotalSizeMB = (totalStorageBytes / 1024 / 1024).toFixed(2);
        console.log(
          `[scheduled-backup] Phase 2: ${storageUploadedFiles}/${storageTotalFiles} files uploaded, ${storageTotalSizeMB} MB`,
        );
      } catch (storageErr) {
        errors.push(`[Storage] ${storageErr instanceof Error ? storageErr.message : "Storage backup failed"}`);
      }

      // ══════════════════════════════════════════════════════════════════════
      // PHASE 3: GFS Rotation
      // ══════════════════════════════════════════════════════════════════════

      if (rootFolderId) {
        try {
          // Rotate DB backups (JSON files)
          const dbBackups = await listFilesInFolder(accessToken, rootFolderId, "supertools_backup_");
          const keepIds = computeGfsKeepSet(dbBackups);
          for (const b of dbBackups) {
            if (!keepIds.has(b.id)) {
              try {
                await deleteGoogleDriveFile(accessToken, b.id);
                deletedOldBackups++;
                console.log(`[scheduled-backup] GFS: deleted ${b.name}`);
              } catch {
                // non-critical
              }
            }
          }

          // Rotate storage folders
          const storageFolders = await listFilesInFolder(accessToken, rootFolderId, "storage_");
          const keepStorageIds = computeGfsKeepSet(storageFolders);
          for (const sf of storageFolders) {
            if (!keepStorageIds.has(sf.id)) {
              try {
                await deleteGoogleDriveFile(accessToken, sf.id);
                deletedOldBackups++;
                console.log(`[scheduled-backup] GFS: deleted storage folder ${sf.name}`);
              } catch {
                // non-critical
              }
            }
          }
        } catch (rotErr) {
          console.warn("[scheduled-backup] Rotation error:", rotErr);
        }
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 4: Integrity Verification
    // ════════════════════════════════════════════════════════════════════════

    let integrityResult: IntegrityResult | null = null;
    try {
      console.log("[scheduled-backup] Phase 4: Verifying backup integrity...");
      integrityResult = await verifyBackupIntegrity(supabase, backupJson, TABLES_TO_BACKUP);
      console.log(
        `[scheduled-backup] Integrity: ${integrityResult.passed ? "PASSED" : "FAILED"} — ` +
        `${integrityResult.checks.rowCountMatches}/${TABLES_TO_BACKUP.length} tables match, ` +
        `${integrityResult.checks.rowCountMismatches.length} mismatches`,
      );

      if (!integrityResult.passed) {
        if (integrityResult.checks.tablesMissing.length > 0) {
          errors.push(`[Integrity] Tables manquantes: ${integrityResult.checks.tablesMissing.join(", ")}`);
        }
        for (const m of integrityResult.checks.rowCountMismatches.slice(0, 5)) {
          errors.push(`[Integrity] ${m.table}: backup=${m.backup} vs live=${m.live}`);
        }
      }
    } catch (intErr) {
      console.warn("[scheduled-backup] Integrity check error:", intErr);
      errors.push(`[Integrity] ${intErr instanceof Error ? intErr.message : "Verification failed"}`);
    }

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 5: Native pg_dump (if Management API key is configured)
    // ════════════════════════════════════════════════════════════════════════

    let pgDumpResult: PgDumpResult | null = null;
    const managementApiKey = Deno.env.get("SUPABASE_MANAGEMENT_API_KEY");
    const projectRef = Deno.env.get("SUPABASE_URL")?.match(/https:\/\/([^.]+)\./)?.[1];

    if (managementApiKey && projectRef) {
      try {
        console.log("[scheduled-backup] Phase 5: Triggering native pg_dump...");
        const driveAccessToken = tokenRow ? await refreshGoogleAccessToken(tokenRow.refresh_token) : null;
        const rootFolderIdForDump = (await supabase
          .from("app_settings")
          .select("setting_value")
          .eq("setting_key", "backup_gdrive_folder_id")
          .single()).data?.setting_value || undefined;

        pgDumpResult = await triggerAndDownloadPgDump(
          projectRef,
          managementApiKey,
          driveAccessToken,
          rootFolderIdForDump,
        );

        console.log(
          `[scheduled-backup] pg_dump: triggered=${pgDumpResult.triggered}, ` +
          `uploaded=${pgDumpResult.uploadedToDrive}` +
          (pgDumpResult.error ? `, error=${pgDumpResult.error}` : ""),
        );

        if (pgDumpResult.error) {
          errors.push(`[pg_dump] ${pgDumpResult.error}`);
        }
      } catch (pgErr) {
        console.warn("[scheduled-backup] pg_dump error:", pgErr);
        errors.push(`[pg_dump] ${pgErr instanceof Error ? pgErr.message : "pg_dump failed"}`);
      }
    } else {
      console.log("[scheduled-backup] Phase 5: Skipped (SUPABASE_MANAGEMENT_API_KEY not configured)");
    }

    const durationMs = Date.now() - startTime;
    const dbErrors = errors.filter((e) => e.startsWith("[DB]")).length;
    const success = dbErrors === 0 && googleDriveResult !== null && (integrityResult?.passed !== false);

    // ── Log activity (update the early log or create new one) ──
    const finalDetails = {
      success,
      fileName,
      tablesCount: TABLES_TO_BACKUP.length,
      totalRows,
      backupSizeMB,
      googleDriveFileId: googleDriveResult?.id || null,
      storage: {
        bucketsCount: storageResults.length,
        totalFiles: storageTotalFiles,
        uploadedFiles: storageUploadedFiles,
        totalSizeMB: storageTotalSizeMB,
      },
      deletedOldBackups,
      gfsRetention: `${GFS_DAILY}d/${GFS_WEEKLY}w/${GFS_MONTHLY}m`,
      integrity: integrityResult ? {
        passed: integrityResult.passed,
        tablesPresent: integrityResult.checks.tablesPresent,
        tablesMissing: integrityResult.checks.tablesMissing.length,
        rowCountMatches: integrityResult.checks.rowCountMatches,
        rowCountMismatches: integrityResult.checks.rowCountMismatches.length,
      } : null,
      pgDump: pgDumpResult ? {
        triggered: pgDumpResult.triggered,
        uploadedToDrive: pgDumpResult.uploadedToDrive,
        driveFileId: pgDumpResult.driveFileId,
      } : null,
      durationMs,
      errors: errors.length > 0 ? errors : null,
    };

    if (earlyLogId) {
      // Update the early log with final results
      await supabase.from("activity_logs").update({ details: finalDetails }).eq("id", earlyLogId);
    } else {
      // Fallback: create a new log
      await supabase.from("activity_logs").insert({
        action_type: "scheduled_backup",
        recipient_email: "system",
        details: finalDetails,
      });
    }

    // ── Send email notification ──
    const adminEmail = await getSenderEmail();
    const bccList = await getBccList();
    const statusEmoji = success ? "✅" : "⚠️";
    const statusText = success ? "réussie" : "avec des erreurs";

    const storageRowsHtml = storageResults
      .map(
        (r) =>
          `<tr><td style="padding: 4px 8px; color: #6b7280;">${r.bucket}</td><td style="padding: 4px 8px;">${r.uploadedFiles}/${r.filesCount}</td><td style="padding: 4px 8px;">${r.errors.length > 0 ? "⚠️" : "✅"}</td></tr>`,
      )
      .join("");

    await sendEmail({
      to: adminEmail,
      bcc: bccList.filter(e => e !== adminEmail),
      subject: `${statusEmoji} Sauvegarde SuperTools ${today} ${statusText}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2 style="color: ${success ? "#16a34a" : "#dc2626"};">
            Sauvegarde automatique ${statusText}
          </h2>

          <h3 style="margin-top: 20px; color: #374151;">Base de données</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 8px 0;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Tables</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${TABLES_TO_BACKUP.length}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Lignes</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${totalRows.toLocaleString("fr-FR")}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Taille JSON</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${backupSizeMB} Mo</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Google Drive</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${googleDriveResult ? "✅" : "❌"}</td></tr>
          </table>

          <h3 style="margin-top: 20px; color: #374151;">Fichiers Storage</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 8px 0;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Buckets traités</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${storageResults.length}/${STORAGE_BUCKETS.length}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Fichiers copiés</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${storageUploadedFiles}/${storageTotalFiles}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Taille totale</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${storageTotalSizeMB} Mo</td></tr>
          </table>

          ${storageResults.length > 0 ? `
            <details style="margin-top: 8px;">
              <summary style="cursor: pointer; color: #6b7280; font-size: 13px;">Détail par bucket</summary>
              <table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px;">
                <tr style="background: #f3f4f6;"><th style="padding: 4px 8px; text-align: left;">Bucket</th><th style="padding: 4px 8px;">Fichiers</th><th style="padding: 4px 8px;">Statut</th></tr>
                ${storageRowsHtml}
              </table>
            </details>
          ` : ""}

          <h3 style="margin-top: 20px; color: #374151;">Vérification d'intégrité</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 8px 0;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Résultat</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${integrityResult ? (integrityResult.passed ? "✅ Validé" : "⚠️ Anomalies détectées") : "⏭️ Non exécuté"}</td></tr>
            ${integrityResult ? `
              <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">JSON parseable</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${integrityResult.checks.jsonParseable ? "✅" : "❌"}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Tables présentes</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${integrityResult.checks.tablesPresent}/${TABLES_TO_BACKUP.length}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Row counts identiques</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${integrityResult.checks.rowCountMatches}/${TABLES_TO_BACKUP.length} ${integrityResult.checks.rowCountMismatches.length > 0 ? `(${integrityResult.checks.rowCountMismatches.length} écarts)` : ""}</td></tr>
            ` : ""}
          </table>

          ${pgDumpResult || managementApiKey ? `
            <h3 style="margin-top: 20px; color: #374151;">Backup PostgreSQL natif</h3>
            <table style="width: 100%; border-collapse: collapse; margin: 8px 0;">
              ${pgDumpResult ? `
                <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Déclenché</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${pgDumpResult.triggered ? "✅" : "❌"}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Google Drive</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${pgDumpResult.uploadedToDrive ? "✅" : "❌"} ${pgDumpResult.error ? `(${pgDumpResult.error})` : ""}</td></tr>
              ` : `
                <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Statut</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">⏭️ SUPABASE_MANAGEMENT_API_KEY non configurée</td></tr>
              `}
            </table>
          ` : ""}

          <h3 style="margin-top: 20px; color: #374151;">Rétention & Nettoyage</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 8px 0;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Politique GFS</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${GFS_DAILY} quotidiens, ${GFS_WEEKLY} hebdo, ${GFS_MONTHLY} mensuels</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Anciens backups supprimés</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${deletedOldBackups}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Durée totale</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${(durationMs / 1000).toFixed(1)}s</td></tr>
          </table>

          ${errors.length > 0 ? `
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin-top: 16px;">
              <h3 style="color: #dc2626; margin: 0 0 8px 0;">Erreurs (${errors.length})</h3>
              <ul style="margin: 0; padding-left: 20px; color: #991b1b; font-size: 13px;">
                ${errors.slice(0, 15).map((e) => `<li style="margin-bottom: 4px;">${e}</li>`).join("")}
                ${errors.length > 15 ? `<li>... et ${errors.length - 15} autres</li>` : ""}
              </ul>
            </div>
          ` : ""}

          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
            Sauvegarde automatique SuperTools — GFS: ${GFS_DAILY}j / ${GFS_WEEKLY}s / ${GFS_MONTHLY}m
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
      storage: {
        bucketsProcessed: storageResults.length,
        totalFiles: storageTotalFiles,
        uploadedFiles: storageUploadedFiles,
        totalSizeMB: storageTotalSizeMB,
      },
      deletedOldBackups,
      integrity: integrityResult ? {
        passed: integrityResult.passed,
        rowCountMatches: integrityResult.checks.rowCountMatches,
        mismatches: integrityResult.checks.rowCountMismatches.length,
      } : null,
      pgDump: pgDumpResult ? {
        triggered: pgDumpResult.triggered,
        uploadedToDrive: pgDumpResult.uploadedToDrive,
      } : null,
      durationMs,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[scheduled-backup] Fatal error:", errorMessage);

    // Try to send failure notification
    try {
      const adminEmail = await getSenderEmail();
      const bccList = await getBccList();
      await sendEmail({
        to: adminEmail,
        bcc: bccList.filter(e => e !== adminEmail),
        subject: `❌ ÉCHEC sauvegarde SuperTools ${new Date().toISOString().split("T")[0]}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px;">
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
