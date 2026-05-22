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
  "backup-export",
  "backup-import",
  "business-health-score",
  "capture-screenshots",
  "chatbot-query",
  "check-convention-status",
  "check-daily-actions-completion",
  "check-functions-health",
  "check-login-attempt",
  "cleanup-pending-email-drafts",
  "commercial-challenge",
  "create-learner-account",
  "create-program-upload-url",
  "create-review-image-upload-url",
  "crm-ai-assist",
  "crm-elementor-webhook",
  "crm-extract-opportunity",
  "crm-send-email",
  "crm-slack-notify",
  "extract-balance-sheet",
  "extract-objectives-from-pdf",
  "fireflies-backfill",
  "fireflies-webhook",
  "force-send-scheduled-email",
  "generate-attendance-pdf",
  "generate-certificates",
  "generate-convention-formation",
  "generate-daily-actions",
  "generate-daily-agenda",
  "generate-location-contract",
  "generate-micro-devis",
  "generate-mission-8p",
  "generate-mission-summary",
  "generate-monthly-report",
  "generate-quiz",
  "generate-quote-email",
  "generate-quote-lines",
  "generate-quote-pdf",
  "generate-quote-synthesis",
  "generate-training-program",
  "generate-transcript-content",
  "generate-transcript-title",
  "generate-woocommerce-coupon",
  "google-calendar-events",
  "google-drive-auth",
  "google-routes",
  "improve-email-content",
  "index-documents",
  "log-login-attempt",
  "manage-learner-account",
  "media-slack-notify",
  "monitor-indexation-health",
  "network-ai-assistant",
  "network-generate-actions",
  "notify-learner-lms-message",
  "notify-lms-comment",
  "notify-session-full",
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
  "process-evaluation-submission",
  "process-event-reminders",
  "process-indexation-queue",
  "process-live-reminders",
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
  "request-coached-formula",
  "resend-email-tracking",
  "resend-inbound-webhook",
  "resolve-formulaire",
  "retry-failed-email",
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
  "send-devis-signature-request",
  "send-elearning-access",
  "send-evaluation-reminder",
  "send-event-share-email",
  "send-event-update-email",
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
  "supertilt-partner-portal",
  "supertilt-restock-email",
  "supertilt-send-email",
  "supertilt-webhook",
  "support-analyze-ticket",
  "time-tracker-github-import",
  "transcribe-audio",
  "transcribe-audio-long",
  "upload-admin-document",
  "upload-balance-sheet",
  "upload-content-image",
  "upload-crm-attachment",
  "upload-crm-image",
  "upload-event-media",
  "upload-learner-photo",
  "upload-lms-content",
  "upload-media-file",
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
  "zapier-create-training",
];

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const PROBE_TIMEOUT_MS = 8000;

async function probeFunction(name: string): Promise<"deployed" | "missing" | "unknown"> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "OPTIONS",
      signal: controller.signal,
      headers: {
        "Access-Control-Request-Method": "POST",
        Origin: "https://supertools",
      },
    });
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
    const CONCURRENCY = 8;
    const results: { name: string; status: "deployed" | "missing" | "unknown" }[] = [];
    for (let i = 0; i < EXPECTED_FUNCTIONS.length; i += CONCURRENCY) {
      const batch = EXPECTED_FUNCTIONS.slice(i, i + CONCURRENCY);
      const settled = await Promise.all(
        batch.map(async (name) => ({ name, status: await probeFunction(name) })),
      );
      results.push(...settled);
    }

    const deployed = results.filter((r) => r.status === "deployed");
    const missing = results.filter((r) => r.status === "missing");
    const unknown = results.filter((r) => r.status === "unknown");

    return createJsonResponse({
      checked_at: new Date().toISOString(),
      total: EXPECTED_FUNCTIONS.length,
      deployed: deployed.length,
      missing: missing.length,
      unknown: unknown.length,
      functions: results.map((r) => ({ ...r, response_time_ms: 0 })),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("check-functions-health error:", errorMessage);
    return createErrorResponse(errorMessage);
  }
});
