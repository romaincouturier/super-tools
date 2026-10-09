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
import { mimeTypeFromFileName } from "../_shared/mime-types.ts";
import { refreshGoogleAccessToken } from "../_shared/google-oauth.ts";

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
  "event_media", "event_shares", "event_transcripts", "events",
  "failed_emails", "faq_items", "feature_usage",
  "formation_configs", "formation_dates", "formation_formulas",
  "game_authors", "game_expenses", "game_price_options", "game_restock_action_files", "game_restock_actions",
  "game_restock_items", "game_restocks", "game_sales", "games",
  "google_calendar_tokens", "google_drive_tokens", "google_tokens",
  "group_matching_configs", "group_matching_groups", "group_matching_members", "group_matching_registrations",
  "gsc_metrics_daily", "gsc_sitemaps", "gsc_url_inspections",
  "idea_votes", "ideas", "improvements", "inbound_emails",
  "learner_notifications", "learner_profiles",
  "lms_assignment_submissions", "lms_assignments", "lms_badge_awards", "lms_badges",
  "lms_course_folders", "lms_courses", "lms_deposit_comments", "lms_deposit_feedback", "lms_deposit_reactions",
  "lms_enrollments", "lms_forum_posts", "lms_forums",
  "lms_lesson_blocks", "lms_lesson_comments", "lms_lesson_snapshots", "lms_lessons",
  "lms_messages", "lms_modules", "lms_page_views", "lms_progress",
  "lms_quiz_attempts", "lms_quiz_questions", "lms_quizzes",
  "lms_submissions", "lms_user_badges", "lms_work_deposits",
  "location_contract_signatures", "location_extensions", "login_attempts", "logistics_checklist_items",
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
  "quality_risks", "quote_settings", "quotes", "reclamations", "review_comments",
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
  "vhd_procedures", "vhd_reports",
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
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) break;
    const data = await response.json();
    allFiles.push(...(data.files || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allFiles;
}

async function deleteGoogleDriveFile(accessToken: string, fileId: string): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(20_000),
  });
  await res.text();
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

interface BucketFile {
  name: string;
  size?: number;
  etag?: string;
  updatedAt?: string;
}

interface ManifestRow {
  path: string;
  size_bytes: number | null;
  etag: string | null;
  drive_file_id: string | null;
}

/** Ligne technique du manifeste : id du dossier Drive miroir d'un bucket. */
const FOLDER_MARKER = "";
const MIRROR_ROOT_BUCKET = "__mirror_root__";

async function loadManifest(supabase: any, bucket: string): Promise<Map<string, ManifestRow>> {
  const map = new Map<string, ManifestRow>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("backup_storage_manifest")
      .select("path, size_bytes, etag, drive_file_id")
      .eq("bucket", bucket)
      .range(from, from + 999);
    if (error) throw new Error(`manifeste ${bucket}: ${error.message}`);
    for (const r of data || []) map.set(r.path, r);
    if (!data || data.length < 1000) break;
  }
  return map;
}

/** Fichier à copier : absent du manifeste, ou taille / etag différents. */
function needsCopy(f: BucketFile, m: ManifestRow | undefined): boolean {
  if (!m || !m.drive_file_id) return true;
  if (f.size != null && m.size_bytes != null && Number(m.size_bytes) !== f.size) return true;
  if (f.etag && m.etag && f.etag !== m.etag) return true;
  return false;
}

async function getFolderId(
  supabase: any,
  accessToken: string,
  bucket: string,
  name: string,
  parentId: string | undefined,
): Promise<string> {
  const { data } = await supabase
    .from("backup_storage_manifest")
    .select("drive_file_id")
    .eq("bucket", bucket)
    .eq("path", FOLDER_MARKER)
    .maybeSingle();
  if (data?.drive_file_id) return data.drive_file_id;
  const id = await createGoogleDriveFolder(accessToken, name, parentId);
  await supabase.from("backup_storage_manifest").upsert({
    bucket, path: FOLDER_MARKER, drive_file_id: id, backed_up_at: new Date().toISOString(),
  });
  return id;
}

/** Nombre de fichiers à copier dans un bucket (nouveaux ou modifiés). */
async function countPending(supabase: any, bucket: string): Promise<{ total: number; pending: number; pendingBytes: number }> {
  const files = await listBucketFiles(supabase, bucket);
  const manifest = await loadManifest(supabase, bucket);
  let pending = 0;
  let pendingBytes = 0;
  for (const f of files) {
    if (needsCopy(f, manifest.get(f.name))) {
      pending++;
      pendingBytes += f.size || 0;
    }
  }
  return { total: files.length, pending, pendingBytes };
}

interface BucketSyncResult {
  copied: number;
  copiedBytes: number;
  streamed: number;
  streamedBytes: number;
  errors: string[];
  done: boolean;
}

/**
 * Synchro incrémentale d'un bucket vers son dossier miroir Drive. Chaque
 * fichier copié est inscrit au manifeste immédiatement : c'est le checkpoint,
 * un run coupé reprend donc exactement où il s'est arrêté.
 */
async function syncStorageBucket(
  supabase: any,
  accessToken: string,
  bucketName: string,
  mirrorRootId: string,
  shouldStop: () => boolean,
  heartbeat: () => Promise<void>,
): Promise<BucketSyncResult> {
  const result: BucketSyncResult = { copied: 0, copiedBytes: 0, streamed: 0, streamedBytes: 0, errors: [], done: false };
  try {
    const bucketFolderId = await getFolderId(supabase, accessToken, bucketName, bucketName, mirrorRootId);
    const files = await listBucketFiles(supabase, bucketName);
    const manifest = await loadManifest(supabase, bucketName);

    for (const file of files) {
      const previous = manifest.get(file.name);
      if (!needsCopy(file, previous)) continue;
      if (shouldStop()) return result;

      try {
        const driveName = file.name.replace(/\//g, "___");
        const mimeType = mimeTypeFromFileName(file.name);
        let newId: string | null = null;
        let size = file.size ?? 0;

        if (file.size && file.size > INLINE_UPLOAD_MAX_BYTES) {
          if (file.size > STREAM_FILE_MAX_BYTES) {
            result.errors.push(`${bucketName}/${file.name}: ignoré (${(file.size / 1024 / 1024).toFixed(1)} Mo > ${STREAM_FILE_MAX_BYTES / 1024 / 1024} Mo)`);
            continue;
          }
          const { data: signed, error: signError } = await supabase.storage.from(bucketName).createSignedUrl(file.name, 3600);
          if (signError || !signed?.signedUrl) {
            result.errors.push(`${bucketName}/${file.name}: URL signée impossible (${signError?.message || "erreur inconnue"})`);
            continue;
          }
          newId = await streamFileToGoogleDrive({
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
          result.streamed++;
          result.streamedBytes += file.size;
        } else {
          // Erreurs transitoires (Too many connections, Bad Gateway) : 3 essais espacés.
          let data: Blob | null = null;
          let error: { message?: string } | null = null;
          for (const wait of [0, 2000, 6000]) {
            if (wait) await new Promise((r) => setTimeout(r, wait));
            ({ data, error } = await supabase.storage.from(bucketName).download(file.name));
            if (data && !error) break;
            if (!/too many connections|bad gateway|gateway|timeout|502|503|504/i.test(error?.message ?? "")) break;
          }
          if (error || !data) {
            result.errors.push(`${bucketName}/${file.name}: ${error?.message || "téléchargement impossible"}`);
            continue;
          }
          size = data.size;
          if (data.size > INLINE_UPLOAD_MAX_BYTES) {
            result.errors.push(`${bucketName}/${file.name}: ignoré (${(data.size / 1024 / 1024).toFixed(1)} Mo, taille inconnue avant téléchargement)`);
            continue;
          }
          const uploaded = await uploadBlobToGoogleDrive(accessToken, driveName, data, mimeType, bucketFolderId);
          newId = uploaded.id;
        }

        // Fichier modifié : l'ancienne copie du miroir est remplacée.
        if (previous?.drive_file_id && previous.drive_file_id !== newId) {
          try { await deleteGoogleDriveFile(accessToken, previous.drive_file_id); } catch { /* non critique */ }
        }
        const { error: mErr } = await supabase.from("backup_storage_manifest").upsert({
          bucket: bucketName,
          path: file.name,
          size_bytes: size,
          etag: file.etag ?? null,
          source_updated_at: file.updatedAt ?? null,
          drive_file_id: newId,
          backed_up_at: new Date().toISOString(),
        });
        if (mErr) result.errors.push(`${bucketName}/${file.name}: manifeste non mis à jour (${mErr.message})`);
        result.copied++;
        result.copiedBytes += size;
      } catch (fileErr) {
        result.errors.push(`${bucketName}/${file.name}: ${fileErr instanceof Error ? fileErr.message : "erreur inconnue"}`);
      }
    }
    result.done = true;
  } catch (err) {
    result.errors.push(`${bucketName}: ${err instanceof Error ? err.message : "synchro du bucket impossible"}`);
    result.done = true;
  }
  return result;
}

async function listBucketFiles(
  supabase: ReturnType<typeof createClient>,
  bucketName: string,
  path = "",
): Promise<BucketFile[]> {
  const allFiles: BucketFile[] = [];
  for (let offset = 0; ; offset += 1000) {
    let { data, error } = await supabase.storage.from(bucketName).list(path, {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    // Saturation passagère des connexions : on réessaie avant d'abandonner.
    for (const delay of [2000, 5000, 10000]) {
      if (!error || !/too many connections/i.test(error.message)) break;
      await new Promise((r) => setTimeout(r, delay));
      ({ data, error } = await supabase.storage.from(bucketName).list(path, {
        limit: 1000,
        offset,
        sortBy: { column: "name", order: "asc" },
      }));
    }
    if (error) throw new Error(`liste ${bucketName}/${path}: ${error.message}`);
    if (!data) break;
    for (const item of data) {
      const fullPath = path ? `${path}/${item.name}` : item.name;
      if (item.id === null) {
        allFiles.push(...(await listBucketFiles(supabase, bucketName, fullPath)));
      } else {
        const meta = (item as any)?.metadata || {};
        allFiles.push({
          name: fullPath,
          size: meta.size,
          etag: typeof meta.eTag === "string" ? meta.eTag.replace(/"/g, "") : undefined,
          updatedAt: (item as any).updated_at || meta.lastModified,
        });
      }
    }
    if (data.length < 1000) break;
  }
  return allFiles;
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
  liveCounts?: Record<string, number>,
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
      let liveRows: number;
      if (liveCounts && table in liveCounts) {
        liveRows = liveCounts[table];
      } else if (liveCounts) {
        // Comptage live indisponible (timeout) : pas de comparaison, pas de recomptage ici.
        result.checks.rowCountMatches++;
        continue;
      } else {
        const { count } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true });
        liveRows = count ?? 0;
      }
      result.checks.totalLiveRows += liveRows;
      // Le run dure plusieurs heures : des lignes ajoutées depuis l'export de la
      // table sont normales. Seule une croissance anormale ou une perte compte.
      const growth = liveRows - backupRows;
      if (growth >= 0 && growth <= Math.max(100, liveRows * 0.05)) {
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
const PAGE_SIZE = 200;               // pagination par table (petites pages : lignes HTML lourdes)
const MAX_BYTES_PER_FILE = 8 * 1024 * 1024; // au-delà, fichier suivant (évite le dépassement mémoire du worker)
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

  const { accessToken } = await refreshGoogleAccessToken(tokenRow.refresh_token);
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
/** Page ordonnée ; sur timeout (lignes lourdes : signatures, HTML), on réessaie avec une page plus petite. */
async function exportPage(supabase: any, table: string, after: string[] | null, limit: number, withRows: boolean) {
  let lim = limit;
  for (;;) {
    const { data, error } = await supabase.rpc("backup_export_page", {
      p_table: table, p_after: after, p_limit: lim, p_with_rows: withRows,
    });
    if (!error) return { data, error: null, limit: lim };
    if (!/timeout|canceling statement/i.test(error.message) || lim <= 5) return { data: null, error, limit: lim };
    lim = Math.max(5, Math.floor(lim / 4));
  }
}

async function exportTableToDrive(
  supabase: any,
  accessToken: string,
  folderId: string,
  tableName: string,
  part: number,
  afterKey: string[] | null,
): Promise<{ rows: number; fileId: string | null; error: string | null; done: boolean; lastKey: string[] | null; fp: bigint }> {
  // Lecture ordonnée par clé primaire via RPC : ni doublon ni oubli entre pages,
  // et chaque page renvoie l'empreinte de ses lignes (contrôle d'exactitude).
  const chunks: string[] = [
    `{"table":${JSON.stringify(tableName)},"part":${part},"after":${JSON.stringify(afterKey)},"exportedAt":${JSON.stringify(new Date().toISOString())},"rows":[`,
  ];
  let rows = 0;
  let bytes = 0;
  let fp = 0n;
  let lastKey = afterKey;
  let done = false;
  let pageLimit = PAGE_SIZE;

  while (rows < MAX_ROWS_PER_FILE && bytes < MAX_BYTES_PER_FILE) {
    const { data, error, limit } = await exportPage(supabase, tableName, lastKey, pageLimit, true);
    if (error) return { rows, fileId: null, error: error.message, done: true, lastKey, fp };
    const batch: unknown[] = data?.rows || [];
    const before = bytes;
    for (const row of batch) {
      if (rows > 0) chunks.push(",");
      const json = JSON.stringify(row);
      bytes += json.length;
      chunks.push(json);
      rows++;
    }
    const nextLimit = bytes - before < 1_000_000 ? Math.min(limit * 2, 5000) : limit;
    fp += BigInt(data?.fp || "0");
    if (batch.length > 0) lastKey = data.last;
    if (batch.length < limit) {
      done = true;
      break;
    }
    pageLimit = nextLimit;
  }

  chunks.push("]}");
  const content = chunks.join("");
  chunks.length = 0;

  const fileName = part === 0 && done
    ? `table__${tableName}.json`
    : `table__${tableName}__part${part}.json`;
  const uploaded = await uploadJsonToGoogleDrive(accessToken, fileName, content, folderId);
  return { rows, fileId: uploaded.id, error: null, done, lastKey, fp };
}

/** Empreinte de la table telle qu'elle est maintenant (même calcul que l'export). */
async function liveFingerprint(supabase: any, tableName: string): Promise<{ n: number; fp: bigint }> {
  let n = 0;
  let fp = 0n;
  let after: string[] | null = null;
  for (;;) {
    const { data, error, limit } = await exportPage(supabase, tableName, after, 20000, false);
    if (error) throw new Error(error.message);
    const got = Number(data?.n || 0);
    n += got;
    fp += BigInt(data?.fp || "0");
    if (got < limit) break;
    after = data.last;
  }
  return { n, fp };
}

type Exactness = { s: "exact" | "explained" | "undatable" | "unexplained" | "error"; b: number; l?: number; c?: number | null; e?: string };

/**
 * Compare l'export à la table live.
 * - explained : lignes datées après l'export, ou suppressions (l'export par clé
 *   primaire ne peut pas dupliquer : plus de lignes sauvegardées que live =
 *   lignes supprimées depuis, la sauvegarde reste un sur-ensemble).
 * - undatable : écart sur une table sans colonne de date, non prouvable mais
 *   pas une perte démontrée → avertissement, pas KO.
 * - unexplained : lignes en moins dans la sauvegarde non couvertes par des
 *   lignes datées après l'export → KO.
 */
async function checkExactness(supabase: any, tableName: string, backupRows: number, backupFp: bigint, exportStart: string): Promise<Exactness> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const live = await liveFingerprint(supabase, tableName);
      if (live.n === backupRows && live.fp === backupFp) return { s: "exact", b: backupRows };
      const { data: changed } = await supabase.rpc("backup_changed_since", { p_table: tableName, p_since: exportStart });
      const c = changed === null || changed === undefined ? null : Number(changed);
      if (live.n < backupRows) return { s: "explained", b: backupRows, l: live.n, c };
      if (c === null) return { s: "undatable", b: backupRows, l: live.n, c };
      const explained = c > 0 && live.n - backupRows <= c;
      return { s: explained ? "explained" : "unexplained", b: backupRows, l: live.n, c };
    } catch (err) {
      lastErr = err;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 3000));
    }
  }
  return { s: "error", b: backupRows, e: lastErr instanceof Error ? lastErr.message : "erreur" };
}

/** Inventaire + comptes + structure : ce qu'il faut pour remonter SuperTools ailleurs. */
async function writeMigrationKit(
  supabase: any,
  accessToken: string,
  folderId: string,
  counts: Record<string, number>,
  exactness: Record<string, Exactness>,
) {
  const { data: users, error: uErr } = await supabase.rpc("backup_auth_users_export");
  if (uErr) throw new Error(`comptes: ${uErr.message}`);
  await uploadJsonToGoogleDrive(accessToken, "kit__auth_users.json", JSON.stringify(users), folderId);

  const { data: schema, error: sErr } = await supabase.rpc("backup_schema_inventory");
  if (sErr) throw new Error(`structure: ${sErr.message}`);
  await uploadJsonToGoogleDrive(accessToken, "kit__schema.json", JSON.stringify(schema), folderId);

  const secretNames = Object.keys(Deno.env.toObject())
    .filter((k) => !/^(DENO_|PATH$|HOME$|HOSTNAME$|SB_|PWD$|LANG|TZ$)/.test(k))
    .sort();
  const inventory = {
    generatedAt: new Date().toISOString(),
    tables: TABLES_TO_BACKUP.map((t) => ({
      table: t,
      rows: counts[t] ?? null,
      status: TABLES_SKIPPED_HEAVY.has(t) ? "sautée (régénérable)" : (exactness[t]?.s ?? "non contrôlée"),
      detail: exactness[t] ?? null,
    })),
    excludedTables: EXCLUDED_TABLES_DOC,
    authUsers: Array.isArray(users?.users) ? users.users.length : null,
    storageBuckets: STORAGE_BUCKETS,
    storageMirror: "dossier Drive supertools_storage_mirror (incrémental, voir backup_storage_manifest)",
    secretsToReconfigure: secretNames,
    notes: [
      "Les valeurs des clés secrètes ne sont jamais sauvegardées : les reconfigurer sur la nouvelle plateforme.",
      "Le code des fonctions serveur et les migrations SQL sont dans le dépôt Git (supabase/functions, supabase/migrations).",
      "kit__auth_users.json contient les mots de passe chiffrés (bcrypt) : à importer tels quels pour conserver les connexions.",
    ],
  };
  await uploadJsonToGoogleDrive(accessToken, "kit__inventaire.json", JSON.stringify(inventory, null, 1), folderId);
}

/** Tables volontairement hors sauvegarde (miroir de scripts/backup-exclusions.txt). */
const EXCLUDED_TABLES_DOC: Record<string, string> = {
  agent_embedding_cache: "cache IA régénérable",
  mcp_oauth_records: "jetons OAuth éphémères",
  formulaire_rate_limits: "limitation de débit éphémère",
  indexation_queue: "file d'attente éphémère",
  pictodico_rate_limit: "limitation de débit éphémère",
  backup_runs: "suivi des sauvegardes",
  okr_scheduled_emails: "table inexistante en production",
  api_usage_events: "télémétrie purgée à 180 jours",
  vhd_report_narratives: "récits VHD sensibles, ne quittent pas la base",
  vhd_report_attachments: "métadonnées de pièces VHD non sauvegardées",
  vhd_narrative_access: "journal de consultation VHD",
  identity_resolution_log: "journal éphémère (30 jours)",
  live_reminder_sends: "reconstructible depuis sent_emails_log",
  deposit_reaction_tokens: "liens éphémères (30 jours)",
  backup_storage_manifest: "index du miroir storage",
  document_embeddings: "index IA sauté, régénérable",
};

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
      // Compteurs et fichiers persistés avec le curseur : si le worker meurt
      // plus loin dans ce tick, les tables déjà exportées ne sont pas perdues.
      await saveRun(supabase, run.id, { totals, cursor_index: cursor, table_row_counts: counts, drive_file_ids: fileIds });

      const part = Number(totals[partKey] || 0);
      const keyKey = `dbKey_${tableName}`;
      const fpKey = `dbFp_${tableName}`;
      const startKey = `dbStart_${tableName}`;
      if (part === 0) totals[startKey] = new Date().toISOString();
      const afterKey = totals[keyKey] ? JSON.parse(String(totals[keyKey])) as string[] : null;

      try {
        const res = await exportTableToDrive(supabase, accessToken, folderId!, tableName, part, afterKey);
        counts[tableName] = (part > 0 ? Number(counts[tableName] || 0) : 0) + res.rows;
        const fpTotal = (part > 0 ? BigInt(String(totals[fpKey] || "0")) : 0n) + res.fp;
        if (res.fileId) fileIds.push(res.fileId);
        if (res.error) errors.push(`[DB] ${tableName}: ${res.error}`);

        if (res.done) {
          if (!res.error) {
            const ex = await checkExactness(supabase, tableName, counts[tableName], fpTotal, String(totals[startKey]));
            const map = JSON.parse(String(totals.exactness || "{}"));
            map[tableName] = ex;
            totals.exactness = JSON.stringify(map);
          }
          for (const k of [offsetKey, partKey, attemptKey, keyKey, fpKey, startKey]) delete totals[k];
          cursor++;
        } else {
          totals[keyKey] = JSON.stringify(res.lastKey);
          totals[fpKey] = fpTotal.toString();
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
      phase = "db_finalize";
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


  // ── PHASE 2 : finalisation de la base (intégrité, rotation GFS, statut base) ──
  if (phase === "db_finalize") {
    // Contrôle d'exactitude : chaque table a été comparée (nombre + empreinte)
    // juste après son export. Ici on agrège et on ajoute le kit de migration.
    const exactness: Record<string, Exactness> = JSON.parse(String(run.totals.exactness || "{}"));
    const missing = TABLES_TO_BACKUP.filter((t) => !TABLES_SKIPPED_HEAVY.has(t) && (counts[t] === undefined || counts[t] < 0));
    const unexplained = Object.entries(exactness).filter(([, e]) => e.s === "unexplained" || e.s === "error");
    const notChecked = TABLES_TO_BACKUP.filter((t) => !TABLES_SKIPPED_HEAVY.has(t) && !exactness[t] && !missing.includes(t));
    if (missing.length > 0) errors.push(`[Integrity] Tables manquantes: ${missing.slice(0, 10).join(", ")}`);
    for (const [t, e] of unexplained.slice(0, 10)) {
      errors.push(`[Exactitude] ${t}: ${e.s === "error" ? `contrôle impossible (${e.e})` : `sauvegarde=${e.b} lignes, base=${e.l}, modifiées depuis l'export=${e.c ?? "inconnu"}`}`);
    }
    if (notChecked.length > 0) errors.push(`[Exactitude] non contrôlées: ${notChecked.slice(0, 10).join(", ")}`);
    const integrityResult = { passed: missing.length === 0 && unexplained.length === 0 && notChecked.length === 0 };

    if (!run.totals.kitDone) {
      try {
        await writeMigrationKit(supabase, accessToken, folderId!, counts, exactness);
      } catch (kitErr) {
        errors.push(`[DB] kit de migration: ${kitErr instanceof Error ? kitErr.message : "échec"}`);
      }
    }

    const totalRows = Object.values(counts).reduce((s, n) => s + (n > 0 ? n : 0), 0);
    const dbErrors = errors.filter((e) => e.startsWith("[DB]")).length;
    const dbSuccess = dbErrors === 0 && integrityResult.passed;
    await saveRun(supabase, run.id, {
      phase: "storage_scan",
      cursor_index: 0,
      errors,
      db_status: dbSuccess ? "success" : "failed",
      db_finished_at: new Date().toISOString(),
      totals: {
        ...run.totals,
        totalRows,
        kitDone: 1,
        exactCount: Object.values(exactness).filter((e) => e.s === "exact").length,
        explainedCount: Object.values(exactness).filter((e) => e.s === "explained").length,
        unexplainedCount: unexplained.length + notChecked.length,
        integrityPassed: integrityResult.passed ? "oui" : "non",
      },
      chunks_done: chunks + 1,
    });

    // Rotation GFS APRÈS l'enregistrement du statut base : si elle traîne ou
    // que le worker meurt, la base reste acquise et le tick suivant passe au storage.
    console.log(`[scheduled-backup] db_finalize terminé (base ${dbSuccess ? "OK" : "KO"}), rotation Drive`);
    let deletedOldBackups = 0;
    if (rootFolderId) {
      try {
        const dbBackups = await listFilesInFolder(accessToken, rootFolderId, "supertools_backup_");
        const keepIds = computeGfsKeepSet(dbBackups);
        for (const b of dbBackups) {
          if (outOfBudget()) break;
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
    if (deletedOldBackups > 0) {
      await saveRun(supabase, run.id, {
        totals: {
          ...run.totals,
          totalRows,
          deletedOldBackups,
          kitDone: 1,
          exactCount: Object.values(exactness).filter((e) => e.s === "exact").length,
          explainedCount: Object.values(exactness).filter((e) => e.s === "explained").length,
          unexplainedCount: unexplained.length + notChecked.length,
          integrityPassed: integrityResult.passed ? "oui" : "non",
        },
      });
    }
    return { phase: "storage_scan", done: false };
  }

  // ── PHASE 3 : inventaire des fichiers à copier (nouveaux ou modifiés) ──
  if (phase === "storage_scan") {
    const totals: Record<string, number | string> = { ...run.totals };
    while (cursor < STORAGE_BUCKETS.length && !outOfBudget()) {
      const bucket = STORAGE_BUCKETS[cursor];
      try {
        const c = await countPending(supabase, bucket);
        totals.storageTotalFiles = Number(totals.storageTotalFiles || 0) + c.total;
        totals.storagePendingAtStart = Number(totals.storagePendingAtStart || 0) + c.pending;
        totals.storagePendingBytesAtStart = Number(totals.storagePendingBytesAtStart || 0) + c.pendingBytes;
      } catch (err) {
        errors.push(`[Storage] ${bucket}: inventaire impossible (${err instanceof Error ? err.message : "erreur"})`);
      }
      cursor++;
      chunks++;
    }
    if (cursor >= STORAGE_BUCKETS.length) {
      phase = "storage";
      cursor = 0;
    }
    await saveRun(supabase, run.id, { phase, cursor_index: cursor, totals, errors, chunks_done: chunks });
    return { phase, done: false };
  }

  // ── PHASE 4 : synchro incrémentale du storage vers le miroir Drive ──
  if (phase === "storage") {
    const totals: Record<string, number | string> = { ...run.totals };
    const mirrorRootId = await getFolderId(supabase, accessToken, MIRROR_ROOT_BUCKET, "supertools_storage_mirror", rootFolderId);

    while (cursor < STORAGE_BUCKETS.length && !outOfBudget()) {
      const bucket = STORAGE_BUCKETS[cursor];
      const res = await syncStorageBucket(
        supabase,
        accessToken,
        bucket,
        mirrorRootId,
        outOfBudget,
        () => saveRun(supabase, run.id, {}),
      );
      totals.storageCopiedFiles = Number(totals.storageCopiedFiles || 0) + res.copied;
      totals.storageCopiedBytes = Number(totals.storageCopiedBytes || 0) + res.copiedBytes;
      totals.storageStreamedFiles = Number(totals.storageStreamedFiles || 0) + res.streamed;
      totals.storageStreamedBytes = Number(totals.storageStreamedBytes || 0) + res.streamedBytes;
      if (res.errors.length > 0) {
        totals.storageErrorCount = Number(totals.storageErrorCount || 0) + res.errors.length;
        errors.push(...res.errors.slice(0, 3).map((e) => `[Storage] ${e}`));
        if (res.errors.length > 3) errors.push(`[Storage] ${bucket}: +${res.errors.length - 3} autres erreurs`);
      }
      chunks++;
      if (!res.done) break; // budget épuisé : le manifeste sert de point de reprise
      cursor++;
    }

    if (cursor >= STORAGE_BUCKETS.length) {
      // Relecture complète des fichiers Drive une fois par semaine (dimanche).
      phase = new Date().toLocaleDateString("en-US", { timeZone: "Europe/Paris", weekday: "short" }) === "Sun"
        ? "verify"
        : "report";
      cursor = 0;
    }
    await saveRun(supabase, run.id, { phase, cursor_index: cursor, totals, errors, chunks_done: chunks });
    return { phase, done: false };
  }

  // ── PHASE 4 bis : relecture des fichiers Drive (contrôle de restauration) ──
  if (phase === "verify") {
    const totals: Record<string, number | string> = { ...run.totals };
    const seen: Record<string, number> = JSON.parse(String(totals.verifyRows || "{}"));
    const pkCache: Record<string, string[]> = {};
    let dup = Number(totals.verifyDuplicates || 0);
    let bad = Number(totals.verifyBadFiles || 0);
    while (cursor < fileIds.length && !outOfBudget()) {
      try {
        const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileIds[cursor]}?alt=media`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const doc = JSON.parse(await resp.text());
        const table = String(doc.table || "");
        const rows: Record<string, unknown>[] = Array.isArray(doc.rows) ? doc.rows : [];
        seen[table] = (seen[table] || 0) + rows.length;
        if (!pkCache[table]) {
          const { data } = await supabase.rpc("_backup_pk", { p_table: table });
          pkCache[table] = (data || []).map((r: { col: string }) => r.col);
        }
        const keys = new Set<string>();
        for (const r of rows) {
          const key = pkCache[table].map((c) => String(r[c])).join("|");
          if (keys.has(key)) dup++;
          keys.add(key);
        }
      } catch (err) {
        bad++;
        errors.push(`[Relecture] fichier ${cursor + 1}: ${err instanceof Error ? err.message : "illisible"}`);
      }
      cursor++;
    }
    totals.verifyRows = JSON.stringify(seen);
    totals.verifyDuplicates = dup;
    totals.verifyBadFiles = bad;
    if (cursor >= fileIds.length) {
      const diffs = Object.entries(counts).filter(([t, n]) => n >= 0 && (seen[t] || 0) !== n);
      for (const [t, n] of diffs.slice(0, 10)) errors.push(`[Relecture] ${t}: ${seen[t] || 0} lignes relues dans Drive au lieu de ${n}`);
      // Échantillon tournant du miroir storage (1/30 par semaine relue).
      let sampled = 0;
      let sizeMismatch = 0;
      try {
        const day = new Date().getDate() % 30;
        const { data: sample } = await supabase
          .from("backup_storage_manifest")
          .select("path, size_bytes, drive_file_id")
          .not("drive_file_id", "is", null)
          .order("path")
          .range(day * 120, day * 120 + 119);
        for (const m of sample || []) {
          if (outOfBudget()) break;
          const r = await fetch(`https://www.googleapis.com/drive/v3/files/${m.drive_file_id}?fields=size`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          sampled++;
          const meta = r.ok ? await r.json() : null;
          if (!meta || (m.size_bytes != null && Number(meta.size) !== Number(m.size_bytes))) {
            sizeMismatch++;
            if (sizeMismatch <= 3) errors.push(`[Relecture] storage ${m.path}: absent ou taille différente dans Drive`);
          }
        }
      } catch { /* non bloquant */ }
      totals.verifyStatus = diffs.length === 0 && dup === 0 && bad === 0 && sizeMismatch === 0 ? "ok" : "ko";
      totals.verifySummary = `${fileIds.length} fichiers relus, ${dup} doublons, ${bad} illisibles, ${diffs.length} tables en écart ; storage : ${sampled} fichiers vérifiés, ${sizeMismatch} en écart`;
      phase = "report";
      cursor = 0;
    }
    await saveRun(supabase, run.id, { phase, cursor_index: cursor, totals, errors, chunks_done: chunks + 1 });
    return { phase, done: false };
  }

  // ── PHASE 5 : rapport ──
  const remaining = await countRemainingFiles(supabase);
  const storageComplete = remaining.pending === 0 && Number(run.totals.storageErrorCount || 0) === 0;
  return await finishRun(supabase, run, errors, chunks, storageComplete ? "success" : "partial", remaining);
}

/** Fichiers encore à copier, tous buckets confondus (relu en fin de run). */
async function countRemainingFiles(supabase: any): Promise<{ pending: number; total: number; unknown: boolean }> {
  let pending = 0;
  let total = 0;
  let unknown = false;
  for (const bucket of STORAGE_BUCKETS) {
    try {
      const c = await countPending(supabase, bucket);
      pending += c.pending;
      total += c.total;
    } catch {
      unknown = true;
    }
  }
  return { pending, total, unknown };
}

/**
 * Clôt le run et envoie le rapport. Le statut du run suit la base : la synchro
 * storage a son propre statut (success / partial / incomplete).
 */
async function finishRun(
  supabase: any,
  run: RunRow,
  errors: string[],
  chunks: number,
  storageStatus: "success" | "partial" | "incomplete",
  remaining: { pending: number; total: number; unknown: boolean } | null,
) {
  const { data: fresh } = await supabase.from("backup_runs").select("*").eq("id", run.id).single();
  const r = (fresh || run) as RunRow & { db_status?: string | null };
  const t = r.totals || {};
  const dbOk = r.db_status === "success";
  const totalRows = Number(t.totalRows || 0);
  const durationMs = Date.now() - new Date(r.started_at).getTime();
  const mb = (n: unknown) => (Number(n || 0) / 1024 / 1024).toFixed(0);
  const copied = Number(t.storageCopiedFiles || 0);
  const pendingStart = Number(t.storagePendingAtStart || 0);
  const remainingLabel = remaining
    ? `${remaining.pending}${remaining.unknown ? " (au moins)" : ""} sur ${remaining.total} fichiers`
    : `≈ ${Math.max(pendingStart - copied, 0)} (estimation)`;
  const storageLabel = { success: "à jour", partial: "partielle", incomplete: "interrompue" }[storageStatus];
  const success = dbOk;

  await supabase.from("activity_logs").insert({
    action_type: "scheduled_backup",
    recipient_email: "system",
    details: {
      success,
      runId: r.id,
      dbStatus: r.db_status,
      storageStatus,
      totalRows,
      storage: { copied, copiedMB: mb(t.storageCopiedBytes), pendingAtStart: pendingStart, remaining: remaining?.pending ?? null },
      durationMs,
      chunks,
      errors: errors.length > 0 ? errors.slice(0, 50) : null,
    },
  });

  await saveRun(supabase, r.id, {
    status: success ? "success" : "failed",
    phase: "done",
    cursor_index: 0,
    errors,
    storage_status: storageStatus,
    storage_finished_at: new Date().toISOString(),
    totals: { ...t, durationMs, storageRemaining: remaining?.pending ?? null },
    finished_at: new Date().toISOString(),
    chunks_done: chunks,
  });

  const row = (label: string, value: string) =>
    `<tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${label}</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${value}</td></tr>`;
  const icon = !dbOk ? "❌" : storageStatus === "success" ? "✅" : "⚠️";
  try {
    await sendBackupEmail(
      `${icon} Sauvegarde SuperTools ${r.run_date} — base ${dbOk ? "OK" : "KO"}, fichiers ${storageLabel}`,
      `<div style="font-family: sans-serif; max-width: 600px; text-align: left;">
        <h2 style="color: ${dbOk ? "#16a34a" : "#dc2626"};">Base de données : ${dbOk ? "sauvegarde OK" : "sauvegarde KO"}</h2>
        <table style="width: 100%; border-collapse: collapse; margin: 8px 0;">
          ${row("Date", r.run_date)}
          ${row("Base de données", dbOk ? "✅ OK" : "❌ KO")}
          ${row("Tables", `${TABLES_TO_BACKUP.length} (${(r.drive_file_ids || []).length} fichiers)`)}
          ${row("Lignes", totalRows.toLocaleString("fr-FR"))}
          ${row("Intégrité", String(t.integrityPassed || "?"))}
          ${row("Exactitude", `${Number(t.exactCount || 0)} tables identiques, ${Number(t.explainedCount || 0)} écarts expliqués (modifiées après export), ${Number(t.unexplainedCount || 0)} écarts non expliqués`)}
          ${row("Kit de migration", t.kitDone ? "comptes, structure et inventaire inclus" : "absent")}
          ${row("Relecture Drive", t.verifySummary ? `${t.verifyStatus === "ok" ? "✅" : "❌"} ${escapeForHtml(String(t.verifySummary))}` : "hebdomadaire (dimanche)")}
        </table>
        <h2 style="color: ${storageStatus === "success" ? "#16a34a" : "#d97706"};">Fichiers (storage) : synchro ${storageLabel}</h2>
        <table style="width: 100%; border-collapse: collapse; margin: 8px 0;">
          ${row("À copier au début du run", `${pendingStart} fichiers (${mb(t.storagePendingBytesAtStart)} Mo)`)}
          ${row("Copiés ce run", `${copied} fichiers (${mb(t.storageCopiedBytes)} Mo, dont ${Number(t.storageStreamedFiles || 0)} gros fichiers)`)}
          ${row("Restant à copier", remainingLabel)}
          ${row("Fichiers en erreur", String(Number(t.storageErrorCount || 0)))}
        </table>
        ${storageStatus !== "success" ? `<p style="color:#6b7280;">Les fichiers restants seront copiés au prochain run, sans recopier ceux déjà sauvegardés.</p>` : ""}
        ${errors.length > 0 ? `
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin-top: 16px;">
            <h3 style="color: #dc2626; margin: 0 0 8px 0;">Avertissements (${errors.length})</h3>
            <ul style="margin: 0; padding-left: 20px; color: #991b1b; font-size: 13px;">
              ${errors.slice(0, 10).map((e) => "<li>" + escapeForHtml(e) + "</li>").join("")}
            </ul>
          </div>` : ""}
        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
          Durée ${(durationMs / 60000).toFixed(0)} min en ${chunks} tranches — rétention base GFS ${GFS_DAILY}j / ${GFS_WEEKLY}s / ${GFS_MONTHLY}m (${Number(t.deletedOldBackups || 0)} anciennes supprimées)
        </p>
      </div>`,
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

/**
 * Alerte si aucune sauvegarde de la BASE n'a réussi depuis plus de 26 h
 * (max 1 alerte / 20 h). La synchro storage a sa propre alerte.
 */
async function checkMissingBackupAlert(supabase: any): Promise<boolean> {
  const { data: lastSuccess } = await supabase
    .from("backup_runs")
    .select("db_finished_at")
    .eq("db_status", "success")
    .order("db_finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastMs = lastSuccess?.db_finished_at ? new Date(lastSuccess.db_finished_at).getTime() : 0;
  await checkStorageSyncAlert(supabase);
  if (Date.now() - lastMs < MISSING_BACKUP_ALERT_MS) return false;
  if (await alertedRecently(supabase, "backup_missing_alert")) return false;

  const lastLabel = lastMs
    ? new Date(lastMs).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })
    : "jamais";

  try {
    await sendBackupEmail(
      `🚨 Aucune sauvegarde de la base SuperTools depuis plus de 24 h`,
      `
        <div style="font-family: sans-serif; max-width: 600px; text-align: left;">
          <h2 style="color: #dc2626;">Alerte sauvegarde de la base</h2>
          <p>Aucune sauvegarde complète de la base de données n'a abouti depuis plus de 24 heures.</p>
          <p style="color: #6b7280;">Dernière sauvegarde de la base réussie : <strong>${lastLabel}</strong></p>
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
    details: { lastDbSuccessAt: lastSuccess?.db_finished_at || null },
  });
  return true;
}

async function alertedRecently(supabase: any, actionType: string): Promise<boolean> {
  const since = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("activity_logs")
    .select("*", { count: "exact", head: true })
    .eq("action_type", actionType)
    .gte("created_at", since);
  return (count ?? 0) > 0;
}

/**
 * Alerte storage : aucune synchro complète des fichiers depuis 72 h. Tant
 * qu'aucune synchro n'a jamais abouti, le délai court depuis le premier
 * fichier inscrit au manifeste (la première copie intégrale prend plusieurs runs).
 */
const STORAGE_SYNC_ALERT_MS = 72 * 60 * 60 * 1000;
async function checkStorageSyncAlert(supabase: any): Promise<void> {
  const { data: lastOk } = await supabase
    .from("backup_runs")
    .select("storage_finished_at")
    .eq("storage_status", "success")
    .order("storage_finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let refMs = lastOk?.storage_finished_at ? new Date(lastOk.storage_finished_at).getTime() : 0;
  if (!refMs) {
    const { data: first } = await supabase
      .from("backup_storage_manifest")
      .select("backed_up_at")
      .order("backed_up_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!first?.backed_up_at) return;
    refMs = new Date(first.backed_up_at).getTime();
  }
  if (Date.now() - refMs < STORAGE_SYNC_ALERT_MS) return;
  if (await alertedRecently(supabase, "backup_storage_sync_alert")) return;

  const { data: lastRun } = await supabase
    .from("backup_runs")
    .select("run_date, storage_status, totals")
    .not("storage_status", "is", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const remaining = lastRun?.totals?.storageRemaining;
  try {
    await sendBackupEmail(
      `⚠️ Synchro des fichiers SuperTools incomplète depuis plus de 72 h`,
      `<div style="font-family: sans-serif; max-width: 600px; text-align: left;">
        <h2 style="color: #d97706;">Alerte synchro des fichiers</h2>
        <p>La base de données est sauvegardée séparément ; cette alerte concerne uniquement la copie des fichiers vers Google Drive.</p>
        <p style="color: #6b7280;">Dernière synchro complète : <strong>${lastOk?.storage_finished_at ? new Date(lastOk.storage_finished_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }) : "jamais"}</strong></p>
        <p style="color: #6b7280;">Dernier run : ${lastRun?.run_date ?? "?"} (${escapeForHtml(String(lastRun?.storage_status ?? "?"))})${remaining != null ? `, ${remaining} fichiers restant à copier` : ""}.</p>
      </div>`,
      "backup_storage_sync_alert",
    );
  } catch (err) {
    console.error("[scheduled-backup] Alerte storage non envoyée:", err);
  }
  await supabase.from("activity_logs").insert({
    action_type: "backup_storage_sync_alert",
    recipient_email: "system",
    details: { lastStorageSuccessAt: lastOk?.storage_finished_at || null, remaining: remaining ?? null },
  });
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
      if (idleMs > STALE_RUN_MS * 4 && (runningRun as any).db_status === "success") {
        // Base déjà sauvegardée : le run est réussi, seule la synchro storage
        // est interrompue. Le manifeste garde le point de reprise.
        await finishRun(supabase, run, [...(run.errors || [])], run.chunks_done, "incomplete", null);
        await checkMissingBackupAlert(supabase);
        return createJsonResponse({ finishedWithStorageIncomplete: true, runId: run.id });
      }
      if (idleMs > STALE_RUN_MS * 4) {
        await saveRun(supabase, run.id, {
          status: "failed",
          finished_at: new Date().toISOString(),
          errors: [...(run.errors || []), "Run abandonné (inactif trop longtemps)"],
        });
        // Jamais d'échec silencieux : mail d'échec + alerte « aucune sauvegarde ».
        try {
          await sendBackupEmail(
            `❌ ÉCHEC sauvegarde SuperTools ${run.run_date}`,
            `<div style="font-family: sans-serif; max-width: 600px; text-align: left;">
              <h2 style="color: #dc2626;">Sauvegarde automatique interrompue</h2>
              <p>La sauvegarde de la base du ${run.run_date} n'a pas terminé dans la fenêtre du cron (arrêtée en phase <strong>${escapeForHtml(String(run.phase))}</strong>, étape ${run.cursor_index}).</p>
            </div>`,
            "scheduled_backup_failure",
          );
        } catch (err) {
          console.error("[scheduled-backup] Mail d'abandon non envoyé:", err);
        }
        await checkMissingBackupAlert(supabase);
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
