/**
 * Check Functions Health
 *
 * Pings all edge functions via OPTIONS request to verify they are
 * deployed and reachable. Returns status and response time for each.
 *
 * IMPORTANT: When adding a new edge function to the project,
 * add its name to the FUNCTION_NAMES array below so it appears
 * in the monitoring dashboard automatically.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
} from "../_shared/cors.ts";

/**
 * Complete list of all edge functions in the project.
 * Keep this list in sync with supabase/functions/ directories.
 * Excluded: _shared (not a function), check-functions-health (self).
 */
const FUNCTION_NAMES = [
  "ai-content-assist",
  "analyze-evaluations",
  "arena-orchestrate",
  "arena-orchestrator",
  "arena-suggest-experts",
  "backup-export",
  "backup-import",
  "chatbot-query",
  "check-convention-status",
  "check-login-attempt",
  "create-program-upload-url",
  "create-review-image-upload-url",
  "crm-ai-assist",
  "crm-extract-opportunity",
  "crm-send-email",
  "extract-objectives-from-pdf",
  "force-send-scheduled-email",
  "generate-attendance-pdf",
  "generate-certificates",
  "generate-convention-formation",
  "generate-micro-devis",
  "generate-mission-summary",
  "generate-woocommerce-coupon",
  "google-drive-auth",
  "google-drive-auth",
  "improve-email-content",
  "log-login-attempt",
  "onboard-collaborator",
  "process-action-reminders",
  "process-crm-reminders",
  "process-evaluation-submission",
  "process-logistics-reminders",
  "process-mission-testimonials",
  "process-participant-list-reminders",
  "process-scheduled-emails",
  "process-scheduled-emails",
  "record-db-size",
  "refresh-convention-pdf-url",
  "resend-inbound-webhook",
  "retry-failed-email",
  "search-content-ideas",
  "search-siren",
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
  "send-needs-survey",
  "send-needs-survey-reminder",
  "send-password-reset",
  "send-prerequis-warning",
  "send-questionnaire-confirmation",
  "send-thank-you-email",
  "send-training-calendar-invite",
  "send-training-documents",
  "send-welcome-email",
  "submit-attendance-signature",
  "submit-convention-signature",
  "submit-devis-signature",
  "summarize-needs-survey",
  "verify-attendance-signature",
  "verify-convention-signature",
  "verify-devis-signature",
  "zapier-create-training",
];

async function checkFunction(
  baseUrl: string,
  name: string,
  apiKey: string
): Promise<{ name: string; status: string; response_time_ms: number }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${baseUrl}/functions/v1/${name}`, {
      method: "OPTIONS",
      headers: {
        apikey: apiKey,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return {
      name,
      status: res.ok ? "up" : `error_${res.status}`,
      response_time_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      name,
      status: error instanceof DOMException && error.name === "AbortError" ? "timeout" : "down",
      response_time_ms: Date.now() - start,
    };
  }
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const apiKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Check all functions in parallel
    const results = await Promise.allSettled(
      FUNCTION_NAMES.map((name) => checkFunction(supabaseUrl, name, apiKey))
    );

    const functions = results.map((r) =>
      r.status === "fulfilled"
        ? r.value
        : { name: "unknown", status: "error", response_time_ms: 0 }
    );

    const upCount = functions.filter((f) => f.status === "up").length;

    return createJsonResponse({
      checked_at: new Date().toISOString(),
      total: functions.length,
      up: upCount,
      down: functions.length - upCount,
      functions,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("check-functions-health error:", errorMessage);
    return createErrorResponse(errorMessage);
  }
});
