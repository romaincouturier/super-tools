/**
 * Check Functions Health — v2 (background execution)
 *
 * Returns cached results from DB immediately.
 * Triggers a background refresh via EdgeRuntime.waitUntil().
 * Results are stored in edge_function_health table.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
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

async function checkFunction(
  baseUrl: string,
  name: string,
  _apiKey: string
): Promise<{ name: string; status: string; response_time_ms: number }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    // Use OPTIONS (CORS preflight) to check if function is deployed
    // without triggering any business logic (no emails, no alerts)
    const res = await fetch(`${baseUrl}/functions/v1/${name}`, {
      method: "OPTIONS",
      headers: {
        "Origin": "https://health-check.internal",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization, content-type",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    // Any response (including 4xx) means the function is deployed and reachable
    return { name, status: "up", response_time_ms: Date.now() - start };
  } catch (error) {
    return {
      name,
      status: error instanceof DOMException && error.name === "AbortError" ? "timeout" : "down",
      response_time_ms: Date.now() - start,
    };
  }
}

async function runHealthChecks() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const apiKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabase = createClient(supabaseUrl, serviceKey);
  const BATCH_SIZE = 5;
  const DELAY_MS = 500;

  for (let i = 0; i < FUNCTION_NAMES.length; i += BATCH_SIZE) {
    const batch = FUNCTION_NAMES.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((name) => checkFunction(supabaseUrl, name, apiKey))
    );

    const upserts = results.map((r, idx) => {
      const val = r.status === "fulfilled"
        ? r.value
        : { name: batch[idx], status: "error", response_time_ms: 0 };
      return {
        function_name: val.name,
        status: val.status,
        response_time_ms: val.response_time_ms,
        checked_at: new Date().toISOString(),
      };
    });

    await supabase
      .from("edge_function_health")
      .upsert(upserts, { onConflict: "function_name" });

    // Small delay between batches to avoid overwhelming cold starts
    if (i + BATCH_SIZE < FUNCTION_NAMES.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  console.log(`[check-functions-health] Done checking ${FUNCTION_NAMES.length} functions`);
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Start background health check (non-blocking)
    EdgeRuntime.waitUntil(
      runHealthChecks().catch((err) =>
        console.error("[check-functions-health] Background error:", err.message)
      )
    );

    // Return cached results immediately from DB
    const { data: functions } = await supabase
      .from("edge_function_health")
      .select("*")
      .order("function_name");

    const fns = (functions || []).map((f: any) => ({
      name: f.function_name,
      status: f.status,
      response_time_ms: f.response_time_ms,
    }));

    const upCount = fns.filter((f: any) => f.status === "up").length;
    const latestCheck = functions?.length
      ? functions.reduce((a: any, b: any) => (a.checked_at > b.checked_at ? a : b)).checked_at
      : new Date().toISOString();

    return createJsonResponse({
      checked_at: latestCheck,
      total: FUNCTION_NAMES.length,
      up: upCount,
      down: FUNCTION_NAMES.length - upCount,
      functions: fns,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("check-functions-health error:", errorMessage);
    return createErrorResponse(errorMessage);
  }
});
