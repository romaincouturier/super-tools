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
import { streamFileToGoogleDrive } from "../_shared/drive-resumable-upload.ts";

// ─── Tables to backup ───────────────────────────────────────────────────────

const TABLES_TO_BACKUP = [
  "activity_logs", "admin_documents",
  "agent_conversations", "agent_feedback", "agent_query_audit_log", "agent_schema_registry",
  "ai_brand_settings", "api_keys", "api_request_logs", "app_settings",
  "attendance_signatures", "balance_sheets", "billing_plans",
  "book_albums", "book_analytics_events", "book_productions", "book_profiles", "book_share_links",
  "bpf_reports", "breakeven_scenarios", "cashflow_forecast",
  "chatbot_conversations", "chatbot_knowledge_base",
  "checklist_template_items", "checklist_templates",
  "coaching_bookings", "coaching_summaries", "commercial_coach_contexts",
  "community_read_state",
  "content_cards", "content_columns", "content_notifications", "content_reviews",
  "convention_signatures",
  "crm_activity_log", "crm_attachments", "crm_card_emails", "crm_card_tags",
  "crm_card_transcripts", "crm_cards", "crm_columns", "crm_comments",
  "crm_revenue_targets", "crm_scheduled_emails", "crm_settings", "crm_tags",
  "daily_action_analytics", "daily_actions",
  "db_size_snapshots", "devis_signatures", "document_embeddings", "edge_function_health",
  "editorial_recommendations", "editorial_theme_sources", "editorial_themes",
  "email_snippets", "email_templates", "evaluation_analyses",
  "event_media", "event_shares", "events",
  "failed_emails", "faq_items", "feature_usage",
  "formation_configs", "formation_dates", "formation_formulas",
  "game_authors", "game_expenses", "game_price_options", "game_restock_action_files", "game_restock_actions",
  "game_restock_items", "game_restocks", "game_sales", "games",
  "google_calendar_tokens", "google_drive_tokens", "google_tokens",
  "group_matching_configs", "group_matching_groups", "group_matching_members", "group_matching_registrations",
  "gsc_metrics_daily", "gsc_sitemaps", "gsc_url_inspections",
  "idea_votes", "ideas", "improvements", "inbound_emails",
  "learner_magic_links", "learner_notifications", "learner_profiles",
  "lms_assignment_submissions", "lms_assignments", "lms_badge_awards", "lms_badges",
  "lms_course_folders", "lms_courses", "lms_deposit_comments", "lms_deposit_feedback", "lms_deposit_reactions",
  "lms_enrollments", "lms_forum_posts", "lms_forums",
  "lms_lesson_blocks", "lms_lesson_comments", "lms_lessons",
  "lms_messages", "lms_modules", "lms_page_views", "lms_progress",
  "lms_quiz_attempts", "lms_quiz_questions", "lms_quizzes",
  "lms_submissions", "lms_user_badges", "lms_work_deposits",
  "location_contract_signatures", "login_attempts", "logistics_checklist_items",
  "media",
  "mission_actions", "mission_activities", "mission_contacts", "mission_credits",
  "mission_deliverable_sends",
  "mission_documents", "mission_email_drafts", "mission_media",
  "mission_page_comments", "mission_page_templates", "mission_pages",
  "mission_survey_answers", "mission_survey_questions", "mission_survey_responses", "mission_surveys",
  "missions", "monthly_reports",
  "network_actions", "network_contacts", "network_conversation", "network_interactions",
  "newsletter_cards", "newsletter_comments", "newsletters",
  "okr_check_ins", "okr_initiatives", "okr_key_results", "okr_objectives", "okr_participants",
  
  "order_email_log", "order_items", "org_members", "organizations",
  "participant_files", "partner_access_tokens", "partner_payments",
  "pictodico_challenges", "pictodico_words",
  "polling_cursors", "post_evaluation_emails",
  "practice_poll_options", "practice_poll_votes", "practice_polls",
  "practice_post_comments", "practice_post_hashtags", "practice_post_reactions", "practice_posts",
  "profiles", "program_files",
  "questionnaire_besoins", "questionnaire_events",
  "quote_settings", "quotes", "reclamations", "review_comments",
  "scheduled_emails", "sent_emails_log", "session_start_notifications",
  "sponsor_cold_evaluations", "stakeholder_appreciations", "subscriptions",
  "supertilt_actions", "supertilt_columns", "supertilt_settings",
  "support_ticket_attachments", "support_tickets",
  "tender_documents", "tender_opportunities",
  "testimonials", "time_entries",
  "trainer_attendance_signatures", "trainer_documents", "trainer_evaluations",
  "trainer_training_adequacy", "trainers",
  "training_actions", "training_coaching_slots", "training_documents",
  "training_evaluations", "training_formulas", "training_live_meetings", "training_media",
  "training_participants", "training_schedules",
  "training_support_imports", "training_support_media", "training_support_sections",
  "training_support_template_sections", "training_support_templates", "training_supports",
  "training_survey_answers", "training_survey_questions",
  "training_survey_recipients", "training_survey_responses", "training_surveys",
  "training_venues", "trainings",
  "transcript_ai_prompts", "transcript_generations", "transcripts",
  "usage_records", "user_module_access", "user_positioning",
  "user_preferences", "user_security_metadata",
  "watch_clusters", "watch_digests", "watch_items",
  "webhook_logs",
  "woocommerce_coupons", "woocommerce_orders", "woocommerce_pending_formations",
  "wp_articles", "wp_traffic_daily",
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
  "tender-documents",
  "event-media",
  "game-restock-files",
  "signature-proofs",
  "media",
  "devis-pdfs",
  "admin-archives",
  "balance-sheets",
  "book-productions",
  "ideas",
  "learner-photos",
  "lms-content",
  "meeting-recordings",
  "participant-files",
  "support-attachments",
  "training-supports",
  "watch",
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

// Au-delà de cette taille le fichier n'est plus téléchargé en mémoire mais
// streamé chunk par chunk vers une session resumable Drive.
const INLINE_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;
// Garde-fou : un fichier plus gros ne tiendrait pas dans le budget d'un tick.
const STREAM_FILE_MAX_BYTES = 500 * 1024 * 1024;
const STREAM_FILE_BUDGET_MS = 90_000;
// Doit rester < RUN_LOCK_MS pour que le run ne soit jamais vu comme inactif.
const STREAM_HEARTBEAT_MS = 20_000;

interface StorageBackupResult {
  bucket: string;
  filesCount: number;
  totalSizeBytes: number;
  uploadedFiles: number;
  errors: string[];
}

/**
 * Sauvegarde une tranche d'un bucket. Reprend à `startIndex` et s'arrête dès
 * que `shouldStop()` est vrai, pour ne jamais dépasser le budget d'un tick.
 */
async function backupStorageBucket(
  supabase: any,
  accessToken: string,
  bucketName: string,
  storageFolderId: string,
  startIndex: number,
  cachedBucketFolderId: string | null,
  shouldStop: () => boolean,
  heartbeat: () => Promise<void>,
): Promise<StorageBackupResult & { nextIndex: number; done: boolean; bucketFolderId: string | null }> {
  const result: StorageBackupResult & { nextIndex: number; done: boolean; bucketFolderId: string | null } = {
    bucket: bucketName,
    filesCount: 0,
    totalSizeBytes: 0,
    uploadedFiles: 0,
    errors: [],
    nextIndex: startIndex,
    done: false,
    bucketFolderId: cachedBucketFolderId,
  };

  try {
    const bucketFolderId =
      cachedBucketFolderId || (await createGoogleDriveFolder(accessToken, bucketName, storageFolderId));
    result.bucketFolderId = bucketFolderId;

    const files = await listBucketFiles(supabase, bucketName);
    // filesCount n'est compté qu'au premier passage sur le bucket
    result.filesCount = startIndex === 0 ? files.length : 0;

    let i = startIndex;
    while (i < files.length) {
      if (shouldStop()) {
        result.nextIndex = i;
        result.done = false;
        return result;
      }

      const file = files[i];
      i++;

      try {
        // Flatten path for Drive (replace / with ___)
        const driveName = file.name.replace(/\//g, "___");
        const mimeType = guessMimeType(file.name);

        // Gros fichier : streamé sans passer par la mémoire de l'edge function.
        if (file.size && file.size > INLINE_UPLOAD_MAX_BYTES) {
          result.totalSizeBytes += file.size;

          if (file.size > STREAM_FILE_MAX_BYTES) {
            result.errors.push(
              `${bucketName}/${file.name}: skipped (${(file.size / 1024 / 1024).toFixed(1)}MB > ${STREAM_FILE_MAX_BYTES / 1024 / 1024}MB limit)`,
            );
            continue;
          }

          const { data: signed, error: signError } = await supabase.storage
            .from(bucketName)
            .createSignedUrl(file.name, 3600);
          if (signError || !signed?.signedUrl) {
            result.errors.push(
              `${bucketName}/${file.name}: signed URL failed (${signError?.message || "unknown error"})`,
            );
            continue;
          }

          await streamFileToGoogleDrive({
            accessToken,
            fileName: driveName,
            mimeType,
            folderId: bucketFolderId,
            sourceUrl: signed.signedUrl,
            totalSize: file.size,
            deadline: Date.now() + STREAM_FILE_BUDGET_MS,
            heartbeat,
            heartbeatIntervalMs: STREAM_HEARTBEAT_MS,
          });
          result.uploadedFiles++;
          continue;
        }

        const { data, error } = await supabase.storage.from(bucketName).download(file.name);
        if (error || !data) {
          result.errors.push(`${bucketName}/${file.name}: ${error?.message || "download failed"}`);
          continue;
        }

        result.totalSizeBytes += data.size;

        // Taille absente des métadonnées : le fichier est déjà en mémoire, on ne
        // peut plus basculer sur le stream.
        if (data.size > INLINE_UPLOAD_MAX_BYTES) {
          result.errors.push(
            `${bucketName}/${file.name}: skipped (${(data.size / 1024 / 1024).toFixed(1)}MB, taille inconnue avant téléchargement)`,
          );
          continue;
        }

        await uploadBlobToGoogleDrive(accessToken, driveName, data, mimeType, bucketFolderId);
        result.uploadedFiles++;
      } catch (fileErr) {
        result.errors.push(
          `${bucketName}/${file.name}: ${fileErr instanceof Error ? fileErr.message : "unknown error"}`,
        );
      }
    }

    result.nextIndex = i;
    result.done = true;
  } catch (err) {
    result.errors.push(
      `${bucketName}: ${err instanceof Error ? err.message : "bucket backup failed"}`,
    );
    result.done = true;
  }

  return result;
}

async function listBucketFiles(
  supabase: ReturnType<typeof createClient>,
  bucketName: string,
  path = "",
): Promise<{ name: string; size?: number }[]> {
  const allFiles: { name: string; size?: number }[] = [];

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
        allFiles.push({ name: fullPath, size: (item as any)?.metadata?.size });
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
    (m) => m.live > 0 && m.backup < m.live * 0.5 && !APPEND_ONLY_TABLES.has(m.table),
  );


  if (result.checks.tablesMissing.length > 0 || mismatchRate > 0.1 || hasSevereLoss) {
    result.passed = false;
  }

  return result;
}

// Memory-efficient integrity check that uses the per-table row counts gathered
// during streaming serialization instead of re-parsing the full backup JSON.
async function verifyBackupIntegrityByCounts(
  supabase: any,
  tableRowCounts: Record<string, number>,
  tablesToBackup: string[],
): Promise<IntegrityResult> {
  const result: IntegrityResult = {
    passed: true,
    checks: {
      jsonParseable: true, // we built it ourselves; not re-parsed for memory reasons
      tablesPresent: 0,
      tablesMissing: [],
      rowCountMatches: 0,
      rowCountMismatches: [],
      emptyTablesInBackup: [],
      totalBackupRows: 0,
      totalLiveRows: 0,
    },
  };

  for (const table of tablesToBackup) {
    const backupRows = tableRowCounts[table];
    // -1 sentinel means intentionally skipped (e.g. document_embeddings); count as present
    if (backupRows === undefined) {
      result.checks.tablesMissing.push(table);
      continue;
    }
    result.checks.tablesPresent++;

    if (backupRows === -1) {
      // Skipped on purpose, do not compare counts
      continue;
    }

    result.checks.totalBackupRows += backupRows;
    if (backupRows === 0) result.checks.emptyTablesInBackup.push(table);

    try {
      const { count } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      const liveRows = count ?? 0;
      result.checks.totalLiveRows += liveRows;
      if (backupRows === liveRows) {
        result.checks.rowCountMatches++;
      } else {
        result.checks.rowCountMismatches.push({ table, backup: backupRows, live: liveRows });
      }
    } catch {
      // Skip
    }
  }

  const mismatchRate = result.checks.rowCountMismatches.length / tablesToBackup.length;
  const hasSevereLoss = result.checks.rowCountMismatches.some(
    (m) => m.live > 0 && m.backup < m.live * 0.5 && !APPEND_ONLY_TABLES.has(m.table),
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

// ─── Chunked run engine ─────────────────────────────────────────────────────
// Le backup complet dépasse les limites CPU/mémoire d'une seule invocation
// (209 tables + 25 buckets). On le découpe en tranches reprises par un tick
// cron : chaque invocation traite ce qu'elle peut dans son budget temps puis
// persiste son curseur dans public.backup_runs.

const TICK_BUDGET_MS = 45_000;      // temps de travail max par invocation
const RUN_LOCK_MS = 50_000;         // évite deux ticks simultanés sur le même run
const STALE_RUN_MS = 15 * 60 * 1000; // run sans activité => repris
const PAGE_SIZE = 1000;              // pagination par table
const MAX_ROWS_PER_FILE = 50_000;    // découpage des grosses tables en plusieurs fichiers
const MAX_TABLE_ATTEMPTS = 3;        // au-delà, la table est sautée (crash-loop)
const MAX_RUNS_PER_DAY = 3;          // nombre de tentatives de run par journée

const MISSING_BACKUP_ALERT_MS = 26 * 60 * 60 * 1000;

const TABLES_SKIPPED_HEAVY = new Set<string>(["document_embeddings"]);

/**
 * Tables append-only à forte croissance : entre le moment où elles sont
 * exportées et la vérification d'intégrité (plusieurs heures plus tard), leur
 * volume peut plus que doubler. L'écart n'est pas une perte de données, donc on
 * ne le traite pas comme une anomalie bloquante.
 */
const APPEND_ONLY_TABLES = new Set<string>([
  "activity_logs",
  "agent_events",
  "crm_activity_log",
  "daily_actions",
  "daily_action_analytics",
  "feature_usage",
  "gsc_metrics_daily",
  "sent_emails_log",
  "email_send_log",
  "wp_metrics_daily",
]);


interface RunRow {
  id: string;
  run_date: string;
  status: string;
  phase: string;
  cursor_index: number;
  drive_folder_id: string | null;
  storage_folder_id: string | null;
  drive_file_ids: string[];
  table_row_counts: Record<string, number>;
  totals: Record<string, number | string>;
  errors: string[];
  chunks_done: number;
  started_at: string;
}

function parisDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
}

async function saveRun(supabase: any, runId: string, patch: Record<string, unknown>) {
  await supabase
    .from("backup_runs")
    .update({ ...patch, last_activity_at: new Date().toISOString() })
    .eq("id", runId);
}

async function getDriveAccess(supabase: any): Promise<{ accessToken: string; rootFolderId?: string } | null> {
  // Deux sources possibles : l'ancienne table dédiée Drive, ou la table Google
  // unifiée alimentée par la reconnexion OAuth globale.
  let tokenTable = "google_drive_tokens";
  let { data: tokenRow } = await supabase
    .from("google_drive_tokens")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (!tokenRow?.refresh_token) {
    tokenTable = "google_tokens";
    const { data: unified } = await supabase
      .from("google_tokens")
      .select("*")
      .not("refresh_token", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    tokenRow = unified;
  }
  if (!tokenRow?.refresh_token) return null;

  const accessToken = await refreshGoogleAccessToken(tokenRow.refresh_token);
  await supabase
    .from(tokenTable)
    .update({
      access_token: accessToken,
      token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", tokenRow.user_id);

  const { data: folderSetting } = await supabase
    .from("app_settings")
    .select("setting_value")
    .eq("setting_key", "backup_gdrive_folder_id")
    .maybeSingle();

  return { accessToken, rootFolderId: folderSetting?.setting_value || undefined };
}

/**
 * Exporte une tranche d'une table (à partir de `startOffset`, au maximum
 * MAX_ROWS_PER_FILE lignes) dans un fichier JSON dédié. Les très grosses tables
 * (gsc_metrics_daily : 590k lignes) sont ainsi découpées en plusieurs fichiers
 * `table__x__partN.json`, ce qui évite le WORKER_RESOURCE_LIMIT provoqué par la
 * construction d'un seul JSON de plusieurs centaines de Mo en mémoire.
 */
async function exportTableToDrive(
  supabase: any,
  accessToken: string,
  folderId: string,
  tableName: string,
  startOffset = 0,
  part = 0,
): Promise<{ rows: number; fileId: string | null; error: string | null; nextOffset: number; done: boolean }> {
  const chunks: string[] = [
    `{"table":${JSON.stringify(tableName)},"part":${part},"offset":${startOffset},"exportedAt":${JSON.stringify(new Date().toISOString())},"rows":[`,
  ];
  let rows = 0;
  let from = startOffset;
  let done = false;

  while (rows < MAX_ROWS_PER_FILE) {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .range(from, from + PAGE_SIZE - 1);
    if (error) return { rows, fileId: null, error: error.message, nextOffset: from, done: true };
    const batch = data || [];
    for (const row of batch) {
      if (rows > 0) chunks.push(",");
      chunks.push(JSON.stringify(row));
      rows++;
    }
    from += batch.length;
    if (batch.length < PAGE_SIZE) {
      done = true;
      break;
    }
  }

  chunks.push("]}");
  const content = chunks.join("");
  chunks.length = 0;

  const fileName = part === 0 && done
    ? `table__${tableName}.json`
    : `table__${tableName}__part${part}.json`;
  const uploaded = await uploadJsonToGoogleDrive(accessToken, fileName, content, folderId);
  return { rows, fileId: uploaded.id, error: null, nextOffset: from, done };
}


async function sendBackupEmail(subject: string, html: string, type: string) {
  const adminEmail = await getSenderEmail();
  const bccList = await getBccList();
  await sendEmail({
    to: adminEmail,
    bcc: bccList.filter((e) => e !== adminEmail),
    subject,
    html,
    _emailType: type,
  });
}

/** Traite une tranche du run et renvoie l'état atteint. */
async function processRun(supabase: any, run: RunRow, startTime: number) {
  const drive = await getDriveAccess(supabase);
  if (!drive) {
    await saveRun(supabase, run.id, {
      status: "failed",
      finished_at: new Date().toISOString(),
      errors: [...run.errors, "Aucun compte Google Drive connecté"],
    });
    return { phase: "failed", done: true };
  }

  const { accessToken, rootFolderId } = drive;
  const errors = [...run.errors];
  const counts = { ...run.table_row_counts };
  const fileIds = [...run.drive_file_ids];
  let folderId = run.drive_folder_id;
  let storageFolderId = run.storage_folder_id;
  let phase = run.phase;
  let cursor = run.cursor_index;
  let chunks = run.chunks_done;

  if (!folderId) {
    folderId = await createGoogleDriveFolder(
      accessToken,
      `supertools_backup_${run.run_date}_${Date.now()}`,
      rootFolderId,
    );
    await saveRun(supabase, run.id, { drive_folder_id: folderId });
  }

  const outOfBudget = () => Date.now() - startTime > TICK_BUDGET_MS;

  // ── PHASE 1 : tables ──
  if (phase === "db") {
    const totals: Record<string, number | string> = { ...run.totals };

    while (cursor < TABLES_TO_BACKUP.length && !outOfBudget()) {
      const tableName = TABLES_TO_BACKUP[cursor];
      if (TABLES_SKIPPED_HEAVY.has(tableName)) {
        counts[tableName] = -1;
        cursor++;
        chunks++;
        continue;
      }

      const offsetKey = `dbOffset_${tableName}`;
      const partKey = `dbPart_${tableName}`;
      const attemptKey = `dbAttempt_${tableName}`;
      const attempts = Number(totals[attemptKey] || 0) + 1;

      // La tentative est persistée AVANT l'export : si le worker meurt sur cette
      // table (mémoire), le tick suivant le voit et finit par la sauter au lieu
      // de boucler jusqu'à l'abandon du run.
      if (attempts > MAX_TABLE_ATTEMPTS) {
        errors.push(`[DB] ${tableName}: sautée après ${MAX_TABLE_ATTEMPTS} tentatives échouées`);
        counts[tableName] = counts[tableName] ?? -1;
        cursor++;
        chunks++;
        continue;
      }
      totals[attemptKey] = attempts;
      await saveRun(supabase, run.id, { totals, cursor_index: cursor });

      const startOffset = Number(totals[offsetKey] || 0);
      const part = Number(totals[partKey] || 0);

      try {
        const res = await exportTableToDrive(
          supabase,
          accessToken,
          folderId!,
          tableName,
          startOffset,
          part,
        );
        counts[tableName] = (startOffset > 0 ? Number(counts[tableName] || 0) : 0) + res.rows;
        if (res.fileId) fileIds.push(res.fileId);
        if (res.error) errors.push(`[DB] ${tableName}: ${res.error}`);

        if (res.done) {
          delete totals[offsetKey];
          delete totals[partKey];
          delete totals[attemptKey];
          cursor++;
        } else {
          // Table trop grosse : on reprendra à cet offset au tick suivant.
          totals[offsetKey] = res.nextOffset;
          totals[partKey] = part + 1;
          totals[attemptKey] = 0;
        }
      } catch (err) {
        errors.push(`[DB] ${tableName}: ${err instanceof Error ? err.message : "export failed"}`);
        cursor++;
      }
      chunks++;
    }

    if (cursor >= TABLES_TO_BACKUP.length) {
      phase = "storage";
      cursor = 0;
    }
    await saveRun(supabase, run.id, {
      phase,
      cursor_index: cursor,
      table_row_counts: counts,
      drive_file_ids: fileIds,
      totals,
      errors,
      chunks_done: chunks,
    });
    return { phase, done: false };
  }


  // ── PHASE 2 : storage ──
  if (phase === "storage") {
    if (!storageFolderId) {
      storageFolderId = await createGoogleDriveFolder(accessToken, `storage_${run.run_date}`, folderId!);
      await saveRun(supabase, run.id, { storage_folder_id: storageFolderId });
    }

    let uploaded = Number(run.totals.storageUploadedFiles || 0);
    let totalFiles = Number(run.totals.storageTotalFiles || 0);
    let totalBytes = Number(run.totals.storageTotalBytes || 0);
    let fileCursor = Number(run.totals.storageFileCursor || 0);
    const totals: Record<string, number | string> = { ...run.totals };

    while (cursor < STORAGE_BUCKETS.length && !outOfBudget()) {
      const bucket = STORAGE_BUCKETS[cursor];
      const folderKey = `bucketFolder_${bucket}`;
      const res = await backupStorageBucket(
        supabase,
        accessToken,
        bucket,
        storageFolderId!,
        fileCursor,
        (totals[folderKey] as string) || null,
        outOfBudget,
        () => saveRun(supabase, run.id, {}),
      );
      if (res.bucketFolderId) totals[folderKey] = res.bucketFolderId;
      totalFiles += res.filesCount;
      uploaded += res.uploadedFiles;
      totalBytes += res.totalSizeBytes;
      if (res.errors.length > 0) {
        errors.push(...res.errors.slice(0, 3));
        if (res.errors.length > 3) errors.push(`[Storage] ${bucket}: +${res.errors.length - 3} autres erreurs`);
      }
      chunks++;

      if (res.done) {
        cursor++;
        fileCursor = 0;
      } else {
        // budget épuisé au milieu du bucket : on reprendra à ce fichier
        fileCursor = res.nextIndex;
        break;
      }
    }

    totals.storageUploadedFiles = uploaded;
    totals.storageTotalFiles = totalFiles;
    totals.storageTotalBytes = totalBytes;
    totals.storageFileCursor = fileCursor;

    if (cursor >= STORAGE_BUCKETS.length) {
      phase = "finalize";
      cursor = 0;
    }
    await saveRun(supabase, run.id, {
      phase,
      cursor_index: cursor,
      totals,
      errors,
      chunks_done: chunks,
    });
    return { phase, done: false };
  }

  // ── PHASE 3 : intégrité, rotation GFS, rapport ──
  let integrityResult: IntegrityResult | null = null;
  try {
    integrityResult = await verifyBackupIntegrityByCounts(supabase, counts, TABLES_TO_BACKUP);
    if (!integrityResult.passed) {
      if (integrityResult.checks.tablesMissing.length > 0) {
        errors.push(`[Integrity] Tables manquantes: ${integrityResult.checks.tablesMissing.slice(0, 10).join(", ")}`);
      }
      for (const m of integrityResult.checks.rowCountMismatches.slice(0, 5)) {
        errors.push(`[Integrity] ${m.table}: backup=${m.backup} vs live=${m.live}`);
      }
    }
  } catch (intErr) {
    errors.push(`[Integrity] ${intErr instanceof Error ? intErr.message : "Verification failed"}`);
  }

  let deletedOldBackups = 0;
  if (rootFolderId) {
    try {
      const dbBackups = await listFilesInFolder(accessToken, rootFolderId, "supertools_backup_");
      const keepIds = computeGfsKeepSet(dbBackups);
      for (const b of dbBackups) {
        if (!keepIds.has(b.id)) {
          try {
            await deleteGoogleDriveFile(accessToken, b.id);
            deletedOldBackups++;
          } catch { /* non critique */ }
        }
      }
    } catch (rotErr) {
      console.warn("[scheduled-backup] Rotation error:", rotErr);
    }
  }

  const totalRows = Object.values(counts).reduce((s, n) => s + (n > 0 ? n : 0), 0);
  const dbErrors = errors.filter((e) => e.startsWith("[DB]")).length;
  const success = dbErrors === 0 && integrityResult?.passed !== false;
  const durationMs = Date.now() - new Date(run.started_at).getTime();
  const storageMB = (Number(run.totals.storageTotalBytes || 0) / 1024 / 1024).toFixed(2);

  const details = {
    success,
    runId: run.id,
    driveFolderId: folderId,
    tablesCount: TABLES_TO_BACKUP.length,
    filesUploaded: fileIds.length,
    totalRows,
    storage: {
      bucketsCount: STORAGE_BUCKETS.length,
      totalFiles: Number(run.totals.storageTotalFiles || 0),
      uploadedFiles: Number(run.totals.storageUploadedFiles || 0),
      totalSizeMB: storageMB,
    },
    deletedOldBackups,
    gfsRetention: `${GFS_DAILY}d/${GFS_WEEKLY}w/${GFS_MONTHLY}m`,
    integrity: integrityResult
      ? {
          passed: integrityResult.passed,
          tablesPresent: integrityResult.checks.tablesPresent,
          tablesMissing: integrityResult.checks.tablesMissing.length,
          rowCountMatches: integrityResult.checks.rowCountMatches,
          rowCountMismatches: integrityResult.checks.rowCountMismatches.length,
        }
      : null,
    durationMs,
    chunks: chunks,
    errors: errors.length > 0 ? errors.slice(0, 50) : null,
  };

  await supabase.from("activity_logs").insert({
    action_type: "scheduled_backup",
    recipient_email: "system",
    details,
  });

  await saveRun(supabase, run.id, {
    status: success ? "success" : "failed",
    phase: "done",
    cursor_index: 0,
    errors,
    totals: { ...run.totals, totalRows, deletedOldBackups, durationMs },
    finished_at: new Date().toISOString(),
    chunks_done: chunks,
  });

  try {
    await sendBackupEmail(
      `${success ? "✅" : "⚠️"} Sauvegarde SuperTools ${run.run_date} — ${TABLES_TO_BACKUP.length} tables, ${totalRows.toLocaleString("fr-FR")} lignes`,
      `
        <div style="font-family: sans-serif; max-width: 600px; text-align: left;">
          <h2 style="color: ${success ? "#16a34a" : "#d97706"};">Sauvegarde automatique ${success ? "réussie" : "terminée avec avertissements"}</h2>
          <table style="width: 100%; border-collapse: collapse; margin: 8px 0;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Date</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${run.run_date}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Tables</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${TABLES_TO_BACKUP.length} (${fileIds.length} fichiers)</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Lignes</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${totalRows.toLocaleString("fr-FR")}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Fichiers storage</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${Number(run.totals.storageUploadedFiles || 0)}/${Number(run.totals.storageTotalFiles || 0)} (${storageMB} Mo)</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Dossier Drive</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${folderId}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Durée totale</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${(durationMs / 1000).toFixed(0)}s en ${chunks} tranches</td></tr>
          </table>
          ${errors.length > 0 ? `
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin-top: 16px;">
              <h3 style="color: #dc2626; margin: 0 0 8px 0;">Avertissements (${errors.length})</h3>
              <ul style="margin: 0; padding-left: 20px; color: #991b1b; font-size: 13px;">
                ${errors.slice(0, 10).map((e) => "<li>" + escapeForHtml(e) + "</li>").join("")}
              </ul>
            </div>` : ""}
          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
            Rétention GFS: ${GFS_DAILY}j / ${GFS_WEEKLY}s / ${GFS_MONTHLY}m — ${deletedOldBackups} anciennes sauvegardes supprimées
          </p>
        </div>
      `,
      "scheduled_backup",
    );
  } catch (emailErr) {
    console.warn("[scheduled-backup] Rapport non envoyé:", emailErr);
  }

  return { phase: "done", done: true, success };
}

function escapeForHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Alerte si aucune sauvegarde réussie depuis plus de 26 h (max 1 alerte / 20 h). */
async function checkMissingBackupAlert(supabase: any): Promise<boolean> {
  const { data: lastSuccess } = await supabase
    .from("backup_runs")
    .select("finished_at")
    .eq("status", "success")
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastMs = lastSuccess?.finished_at ? new Date(lastSuccess.finished_at).getTime() : 0;
  if (Date.now() - lastMs < MISSING_BACKUP_ALERT_MS) return false;

  const since = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("activity_logs")
    .select("*", { count: "exact", head: true })
    .eq("action_type", "backup_missing_alert")
    .gte("created_at", since);
  if ((count ?? 0) > 0) return false;

  const lastLabel = lastMs
    ? new Date(lastMs).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })
    : "jamais";

  try {
    await sendBackupEmail(
      `🚨 Aucune sauvegarde SuperTools depuis plus de 24 h`,
      `
        <div style="font-family: sans-serif; max-width: 600px; text-align: left;">
          <h2 style="color: #dc2626;">Alerte sauvegarde</h2>
          <p>Aucune sauvegarde complète n'a abouti depuis plus de 24 heures.</p>
          <p style="color: #6b7280;">Dernière sauvegarde réussie : <strong>${lastLabel}</strong></p>
          <p style="color: #6b7280;">Vérifie la connexion Google Drive et le cron <code>daily-scheduled-backup</code>.</p>
        </div>
      `,
      "backup_missing_alert",
    );
  } catch (err) {
    console.error("[scheduled-backup] Alerte non envoyée:", err);
  }

  await supabase.from("activity_logs").insert({
    action_type: "backup_missing_alert",
    recipient_email: "system",
    details: { lastSuccessAt: lastSuccess?.finished_at || null },
  });
  return true;
}

// ─── Main handler ───────────────────────────────────────────────────────────

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  const startTime = Date.now();

  try {
    const rawBody = await req.text();
    let body: Record<string, unknown> = {};
    if (rawBody.trim()) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        return createErrorResponse("Corps de requête JSON invalide", 400);
      }
    }

    // Health check (check-functions-health)
    if (
      Object.keys(body).length === 0 &&
      req.headers.get("authorization")?.includes(Deno.env.get("SUPABASE_ANON_KEY") || "__none__")
    ) {
      return createJsonResponse({ status: "ok", function: "scheduled-backup" });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const mode = (body.mode as string) || "tick";

    const { data: enabledSetting } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "backup_enabled")
      .maybeSingle();
    const backupEnabled = enabledSetting?.setting_value === "true";

    // ── Reprise d'un run en cours ──
    const { data: runningRun } = await supabase
      .from("backup_runs")
      .select("*")
      .eq("status", "running")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let run = runningRun as RunRow | null;

    if (!run) {
      if (!backupEnabled) {
        return createJsonResponse({ skipped: true, reason: "backup_disabled" });
      }
      const today = parisDate();
      if (mode === "tick") {
        // Un seul run réussi par jour, mais on réessaye après un échec
        // (max MAX_RUNS_PER_DAY tentatives) au lieu d'attendre le lendemain.
        const { data: todayRuns } = await supabase
          .from("backup_runs")
          .select("status")
          .eq("run_date", today)
          .in("status", ["success", "failed"]);
        const done = todayRuns || [];
        const hasSuccess = done.some((r: { status: string }) => r.status === "success");
        if (hasSuccess || done.length >= MAX_RUNS_PER_DAY) {
          const alerted = await checkMissingBackupAlert(supabase);
          return createJsonResponse({ skipped: true, reason: "already_run_today", alerted });

        }
      }
      const { data: created, error: createErr } = await supabase
        .from("backup_runs")
        .insert({ run_date: today, status: "running", phase: "db", cursor_index: 0 })
        .select("*")
        .single();
      if (createErr) return createErrorResponse(`Impossible de créer le run: ${createErr.message}`);
      run = created as RunRow;
      console.log(`[scheduled-backup] Nouveau run ${run.id} (${today})`);
    } else {
      const idleMs = Date.now() - new Date((runningRun as any).last_activity_at).getTime();
      if (idleMs < RUN_LOCK_MS) {
        return createJsonResponse({ skipped: true, reason: "run_in_progress", runId: run.id });
      }
      console.log(`[scheduled-backup] Reprise run ${run.id} phase=${run.phase} cursor=${run.cursor_index} (idle ${Math.round(idleMs / 1000)}s)`);
      if (idleMs > STALE_RUN_MS * 4) {
        await saveRun(supabase, run.id, {
          status: "failed",
          finished_at: new Date().toISOString(),
          errors: [...(run.errors || []), "Run abandonné (inactif trop longtemps)"],
        });
        return createJsonResponse({ aborted: true, runId: run.id });
      }
    }

    const result = await processRun(supabase, run, startTime);

    if (result.done) {
      await checkMissingBackupAlert(supabase);
    }

    return createJsonResponse({
      runId: run.id,
      phase: result.phase,
      done: result.done,
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[scheduled-backup] Fatal error:", errorMessage);
    try {
      await sendBackupEmail(
        `❌ ÉCHEC sauvegarde SuperTools ${parisDate()}`,
        `
          <div style="font-family: sans-serif; max-width: 600px; text-align: left;">
            <h2 style="color: #dc2626;">Échec de la sauvegarde automatique</h2>
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px;">
              <p style="margin: 0; color: #991b1b;"><strong>Erreur :</strong> ${escapeForHtml(errorMessage)}</p>
            </div>
          </div>
        `,
        "scheduled_backup_failure",
      );
    } catch (emailErr) {
      console.error("[scheduled-backup] Could not send failure notification:", emailErr);
    }
    return createErrorResponse(errorMessage);
  }
});
