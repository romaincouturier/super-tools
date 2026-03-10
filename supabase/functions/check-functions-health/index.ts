/**
 * Check Functions Health — v3 (static list, no pinging)
 *
 * Returns the static list of known edge functions.
 * Does NOT call/ping any function — zero side effects.
 * Status is based on deployment list, not runtime checks.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  corsHeaders,
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
} from "../_shared/cors.ts";

const FUNCTION_NAMES = [
  "ai-content-assist",
  "alert-form-error",
  "analyze-evaluations",
  "analyze-needs-survey",
  "analyze-voice-review",
  "arena-orchestrate",
  "arena-orchestrator",
  "arena-suggest-experts",
  "backup-export",
  "backup-import",
  "business-health-score",
  "chatbot-query",
  "check-convention-status",
  "check-daily-actions-completion",
  "check-login-attempt",
  "create-program-upload-url",
  "create-review-image-upload-url",
  "crm-ai-assist",
  "crm-extract-opportunity",
  "crm-send-email",
  "crm-slack-notify",
  "extract-objectives-from-pdf",
  "force-send-scheduled-email",
  "generate-attendance-pdf",
  "generate-certificates",
  "generate-convention-formation",
  "generate-daily-actions",
  "generate-micro-devis",
  "generate-mission-summary",
  "generate-quiz",
  "generate-training-program",
  "generate-woocommerce-coupon",
  "google-calendar-events",
  "google-drive-auth",
  "google-routes",
  "improve-email-content",
  "log-login-attempt",
  "notify-session-full",
  "onboard-collaborator",
  "process-action-reminders",
  "process-coaching-reminders",
  "process-crm-reminders",
  "process-daily-summary",
  "process-evaluation-submission",
  "process-logistics-reminders",
  "process-mission-testimonials",
  "process-participant-list-reminders",
  "process-scheduled-emails",
  "process-session-start",
  "process-today-reminders",
  "rag-chatbot",
  "reclamation-ai-assist",
  "record-db-size",
  "refresh-convention-pdf-url",
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
  "send-certificate-email",
  "send-content-notification",
  "send-convention-email",
  "send-convention-reminder",
  "send-devis-signature-request",
  "send-elearning-access",
  "send-evaluation-reminder",
  "send-event-share-email",
  "send-event-update-email",
  "send-learner-magic-link",
  "send-mission-deliverables",
  "send-needs-survey",
  "send-needs-survey-reminder",
  "send-password-reset",
  "send-prerequis-warning",
  "send-questionnaire-confirmation",
  "send-thank-you-email",
  "send-trainer-evaluation-email",
  "send-training-calendar-invite",
  "send-training-documents",
  "send-welcome-email",
  "slack-list-channels",
  "stripe-checkout",
  "stripe-portal",
  "stripe-webhook",
  "submit-attendance-signature",
  "submit-convention-signature",
  "submit-devis-signature",
  "summarize-coaching",
  "summarize-needs-survey",
  "verify-attendance-signature",
  "verify-convention-signature",
  "verify-devis-signature",
  "zapier-create-training",
];

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    // Simply return the static list — no HTTP calls, no side effects
    const functions = FUNCTION_NAMES.map((name) => ({
      name,
      status: "deployed",
      response_time_ms: 0,
    }));

    return createJsonResponse({
      checked_at: new Date().toISOString(),
      total: FUNCTION_NAMES.length,
      deployed: FUNCTION_NAMES.length,
      functions,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("check-functions-health error:", errorMessage);
    return createErrorResponse(errorMessage);
  }
});
