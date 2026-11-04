import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { handleCorsPreflightIfNeeded, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";
import { isInternalCall, requireStaff } from "../_shared/cron-auth.ts";
import { summarizeLearnerAccessJobs } from "../_shared/learner-access-batch.ts";
import { resolveTrainingAccess, sendRegisteredLearnerAccessEmail } from "../_shared/learner-account.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SEND_DELAY_MS = 500;
const RUN_BUDGET_MS = 100_000;
const MAX_EMAILS = 500;

/**
 * Emails d'accès apprenant d'un ajout en lot, envoyés côté serveur.
 * - { action: "enqueue", trainingId, emails } (staff) : crée la file et lance le traitement.
 * - { action: "status", batchId } (staff) : bilan du lot.
 * - { action: "process", batchId } (interne) : suite du traitement quand le budget d'un appel est épuisé.
 * L'appelant d'origine (requested_by) est conservé pour les droits et l'exemption admin du quota.
 */
serve(async (req: Request) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = await req.json();
    const action = body?.action;

    if (action === "process") {
      if (!isInternalCall(req)) return createErrorResponse("Forbidden", 403);
      if (typeof body.batchId !== "string") return createErrorResponse("batchId requis", 400);
      runInBackground(processBatch(admin, body.batchId));
      return createJsonResponse({ success: true });
    }

    const caller = await requireStaff(req);
    if (!caller) return createErrorResponse("Forbidden", 403);

    if (action === "status") {
      if (typeof body.batchId !== "string") return createErrorResponse("batchId requis", 400);
      return createJsonResponse({ success: true, ...(await batchStatus(admin, body.batchId)) });
    }

    if (action !== "enqueue") return createErrorResponse("Action inconnue", 400);
    const { trainingId, emails } = body;
    if (typeof trainingId !== "string" || !Array.isArray(emails) || emails.length === 0) {
      return createErrorResponse("trainingId et emails requis", 400);
    }
    const unique = [...new Set(emails.filter((e: unknown) => typeof e === "string" && e.trim()).map((e: string) => e.trim().toLowerCase()))];
    if (unique.length === 0 || unique.length > MAX_EMAILS) return createErrorResponse(`Entre 1 et ${MAX_EMAILS} emails`, 400);

    const batchId = crypto.randomUUID();
    const { error } = await admin.from("learner_access_jobs").insert(
      unique.map((email) => ({ batch_id: batchId, training_id: trainingId, email, requested_by: caller.id })),
    );
    if (error) throw error;
    runInBackground(processBatch(admin, batchId));
    return createJsonResponse({ success: true, batchId, total: unique.length });
  } catch (error) {
    return createErrorResponse(error instanceof Error ? error.message : "Erreur inconnue", 500, {
      cause: error,
      fn: "queue-learner-access-emails",
    });
  }
});

function runInBackground(task: Promise<unknown>) {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime;
  const guarded = task.catch((e) => console.error("[queue-learner-access-emails] batch failed", e));
  if (runtime) runtime.waitUntil(guarded);
}

async function processBatch(admin: SupabaseClient, batchId: string) {
  const started = Date.now();
  const accessCache = new Map<string, Awaited<ReturnType<typeof resolveTrainingAccess>>>();

  while (Date.now() - started < RUN_BUDGET_MS) {
    const { data: next } = await admin
      .from("learner_access_jobs")
      .select("id, training_id, email, requested_by")
      .eq("batch_id", batchId)
      .eq("status", "pending")
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (!next) return;

    // Réservation : un seul traitement par ligne, même si deux appels se chevauchent.
    const { data: claimed } = await admin
      .from("learner_access_jobs")
      .update({ status: "processing" })
      .eq("id", next.id)
      .eq("status", "pending")
      .select("id");
    if (!claimed?.length) continue;

    try {
      let access = accessCache.get(next.training_id);
      if (!access) {
        access = await resolveTrainingAccess(admin, next.training_id);
        accessCache.set(next.training_id, access);
      }
      const result = await sendRegisteredLearnerAccessEmail(admin, next.email, { ...access, callerId: next.requested_by });
      await admin.from("learner_access_jobs").update({
        status: "sent",
        result_kind: result.kind ?? null,
        account_created: result.accountCreated,
        processed_at: new Date().toISOString(),
      }).eq("id", next.id);
    } catch (error) {
      await admin.from("learner_access_jobs").update({
        status: "failed",
        error_message: (error instanceof Error ? error.message : "Erreur inconnue").slice(0, 500),
        processed_at: new Date().toISOString(),
      }).eq("id", next.id);
    }
    await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS));
  }

  // Budget épuisé : relance de la suite dans un nouvel appel.
  await fetch(`${SUPABASE_URL}/functions/v1/queue-learner-access-emails`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-secret": SUPABASE_SERVICE_ROLE_KEY },
    body: JSON.stringify({ action: "process", batchId }),
  });
}

async function batchStatus(admin: SupabaseClient, batchId: string) {
  const { data, error } = await admin
    .from("learner_access_jobs")
    .select("email, status, result_kind, account_created, error_message")
    .eq("batch_id", batchId);
  if (error) throw error;
  return summarizeLearnerAccessJobs(data ?? []);
}
