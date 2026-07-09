/**
 * Check Functions Health — v5 (probes each function via server-side OPTIONS)
 *
 * Maintains a static list of EXPECTED edge functions. Probes each one
 * via OPTIONS preflight to determine which are actually deployed.
 *
 * Status: "deployed" (responds) | "missing" (404 / not found) | "unknown" (network/timeout)
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  corsHeaders,
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
} from "../_shared/cors.ts";
import { verifyAuth, getSupabaseClient } from "../_shared/supabase-client.ts";

const EXPECTED_FUNCTIONS = [
  "add-training-participant",
  "agent-chat",
  "ai-content-assist",
  "alert-form-error",
  "analyze-admin-document",
  "analyze-evaluations",
  "analyze-needs-survey",
  "analyze-voice-review",
  "archive-resolved-tickets",
  "arena-orchestrate",
  "arena-orchestrator",
  "arena-suggest-experts",
  "assemblyai-webhook",
  "backfill-practice-hashtags",
  "backup-export",
  "backup-import",
  "book-public-album",
  "book-record-view",
  "book-upload-production",
  "business-health-score",
  "chatbot-query",
  "check-convention-status",
  "check-daily-actions-completion",
  "check-functions-health",
  "check-login-attempt",
  "cleanup-pending-email-drafts",
  "commercial-challenge",
  "create-event-media-upload-url",
  "create-learner-account",
  "create-media-upload-url",
  "create-program-upload-url",
  "create-review-image-upload-url",
  "crm-ai-assist",
  "crm-elementor-webhook",
  "crm-extract-opportunity",
  "crm-send-email",
  "crm-slack-notify",
  "duplicate-lms-course",
  "enrich-idea",
  "extract-balance-sheet",
  "extract-objectives-from-pdf",
  "find-similar-ideas",
  "fireflies-backfill",
  "fireflies-backfill-range",
  "fireflies-webhook",
  "force-send-scheduled-email",
  "generate-attendance-pdf",
  "generate-certificates",
  "generate-convention-formation",
  "generate-daily-actions",
  "generate-daily-agenda",
  "generate-game-devis",
  "generate-location-contract",
  "generate-micro-devis",
  "generate-mission-8p",
  "generate-mission-summary",
  "generate-monthly-report",
  "generate-practice-hashtags",
  "generate-quiz",
  "generate-quote-email",
  "generate-quote-lines",
  "generate-quote-pdf",
  "generate-quote-synthesis",
  "generate-training-program",
  "generate-transcript-content",
  "generate-transcript-title",
  "generate-woocommerce-coupon",
  "google-auth",
  "google-calendar-events",
  "google-drive-auth",
  "google-routes",
  "ideas-weekly-digest",
  "improve-email-content",
  "index-documents",
  "lms-analyze-audio",
  "log-login-attempt",
  "manage-learner-account",
  "media-slack-notify",
  "monitor-indexation-health",
  "network-ai-assistant",
  "network-generate-actions",
  "notify-learner-lms-message",
  "notify-lms-comment",
  "notify-practice-comment",
  "notify-session-full",
  "notify-survey-response",
  "notify-watch-tag",
  "okr-ai-assistant",
  "onboard-collaborator",
  "pennylane-proxy",
  "pictodico-generate-challenges",
  "pictodico-webhook",
  "poll-drive-testimonials",
  "poll-drive-transcripts",
  "poll-fireflies-transcripts",
  "poll-woocommerce-orders",
  "process-action-reminders",
  "process-coaching-reminders",
  "process-daily-summary",
  "process-elearning-start-reminders",
  "process-evaluation-submission",
  "process-event-reminders",
  "process-indexation-queue",
  "process-live-reminders",
  "process-live-upcoming-notifications",
  "process-logistics-reminders",
  "process-mission-audio-transcriptions",
  "process-mission-scheduled-actions",
  "process-mission-testimonials",
  "process-participant-list-reminders",
  "process-scheduled-emails",
  "process-session-start",
  "process-today-reminders",
  "rag-chatbot",
  "reclamation-ai-assist",
  "reconcile-indexation",
  "reconcile-support-screenshots",
  "record-db-size",
  "refresh-convention-pdf-url",
  "refresh-training-convention-url",
  "register-event-media",
  "request-coached-formula",
  "resend-email-tracking",
  "resend-inbound-webhook",
  "resend-logged-email",
  "resolve-formulaire",
  "retry-failed-email",
  "retry-testimonial-transcript",
  "scheduled-backup",
  "search-content-ideas",
  "search-siren",
  "search-siren-by-name",
  "send-accessibility-needs",
  "send-action-reminder",
  "send-attendance-signature-request",
  "send-booking-reminder",
  "send-broadcast-email",
  "send-certificate-email",
  "send-content-notification",
  "send-convention-email",
  "send-convention-reminder",
  "send-deposit-feedback-notification",
  "send-deposit-trainer-notification",
  "send-devis-signature-request",
  "send-elearning-access",
  "send-evaluation-reminder",
  "send-event-share-email",
  "send-event-update-email",
  "send-group-matching-email",
  "send-learner-magic-link",
  "send-location-contract-email",
  "send-logistics-requirements",
  "send-mission-deliverables",
  "send-mission-email-draft",
  "send-needs-survey",
  "send-needs-survey-reminder",
  "send-participants-emails-request",
  "send-password-reset",
  "send-prerequis-warning",
  "send-questionnaire-confirmation",
  "send-quote-email",
  "send-support-notification",
  "send-template-review-reminder",
  "send-thank-you-email",
  "send-trainer-evaluation-email",
  "send-training-calendar-invite",
  "send-training-documents",
  "send-training-survey",
  "send-venue-booking-request",
  "send-welcome-email",
  "slack-list-channels",
  "stripe-checkout",
  "stripe-portal",
  "stripe-webhook",
  "submit-attendance-signature",
  "submit-convention-signature",
  "submit-devis-signature",
  "submit-drive-transcript",
  "submit-location-signature",
  "summarize-coaching",
  "summarize-needs-survey",
  "supertilt-confirm-shipped",
  "supertilt-partner-portal",
  "supertilt-restock-email",
  "supertilt-send-email",
  "supertilt-webhook",
  "support-analyze-ticket",
  "time-tracker-github-import",
  "training-survey-reminders",
  "transcribe-audio",
  "transcribe-audio-long",
  "trigger-ticket-processing",
  "upload-admin-document",
  "upload-balance-sheet",
  "upload-content-image",
  "upload-crm-attachment",
  "upload-crm-image",
  "upload-event-media",
  "upload-idea-file",
  "upload-learner-photo",
  "upload-lms-content",
  "upload-media-file",
  "upload-meeting-recording",
  "upload-mission-document",
  "upload-mission-file",
  "upload-mission-media",
  "upload-participant-convention",
  "upload-participant-file",
  "upload-participant-invoice",
  "upload-support-attachment",
  "upload-trainer-document",
  "upload-training-document",
  "upload-training-document-field",
  "upload-training-file",
  "upload-watch-file",
  "verify-attendance-signature",
  "verify-convention-signature",
  "verify-devis-signature",
  "watch-check-duplicate",
  "watch-cluster-analysis",
  "watch-process-item",
  "watch-weekly-digest",
  "wp-statistics-proxy",
  "zip-mission-deliverables",
];

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const FIRST_TIMEOUT_MS = 10000;
const RETRY_TIMEOUT_MS = 20000;

async function probeOnce(name: string, timeoutMs: number): Promise<"deployed" | "missing" | "unknown"> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "OPTIONS",
      signal: controller.signal,
      headers: {
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,content-type",
        Origin: "https://supertools",
      },
    });
    try { await res.arrayBuffer(); } catch { /* ignore */ }
    return res.status === 404 ? "missing" : "deployed";
  } catch {
    return "unknown";
  } finally {
    clearTimeout(timeout);
  }
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const CONCURRENCY = 10;
    const results = new Map<string, "deployed" | "missing" | "unknown">();

    // First pass: parallel batches
    for (let i = 0; i < EXPECTED_FUNCTIONS.length; i += CONCURRENCY) {
      const batch = EXPECTED_FUNCTIONS.slice(i, i + CONCURRENCY);
      const settled = await Promise.all(
        batch.map(async (name) => ({ name, status: await probeOnce(name, FIRST_TIMEOUT_MS) })),
      );
      for (const s of settled) results.set(s.name, s.status);
    }

    // Second pass: retry "unknown" with longer timeout and lower concurrency
    const toRetry = [...results.entries()].filter(([, s]) => s === "unknown").map(([n]) => n);
    const RETRY_CONCURRENCY = 4;
    for (let i = 0; i < toRetry.length; i += RETRY_CONCURRENCY) {
      const batch = toRetry.slice(i, i + RETRY_CONCURRENCY);
      const settled = await Promise.all(
        batch.map(async (name) => ({ name, status: await probeOnce(name, RETRY_TIMEOUT_MS) })),
      );
      for (const s of settled) results.set(s.name, s.status);
    }

    // Third pass: final sequential retry for any still-unknown
    const stillUnknown = [...results.entries()].filter(([, s]) => s === "unknown").map(([n]) => n);
    for (const name of stillUnknown) {
      results.set(name, await probeOnce(name, RETRY_TIMEOUT_MS));
    }

    const finalResults = EXPECTED_FUNCTIONS.map((name) => ({
      name,
      status: results.get(name) || "unknown",
    }));

    const deployed = finalResults.filter((r) => r.status === "deployed");
    const missing = finalResults.filter((r) => r.status === "missing");
    const unknown = finalResults.filter((r) => r.status === "unknown");

    return createJsonResponse({
      checked_at: new Date().toISOString(),
      total: EXPECTED_FUNCTIONS.length,
      deployed: deployed.length,
      missing: missing.length,
      unknown: unknown.length,
      functions: finalResults.map((r) => ({ ...r, response_time_ms: 0 })),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("check-functions-health error:", errorMessage);
    return createErrorResponse(errorMessage);
  }
});
