import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  createErrorResponse,
  createJsonResponse,
  handleCorsPreflightIfNeeded,
} from "../_shared/cors.ts";
import { ensureLearnerAccount } from "../_shared/learner-account.ts";
import { requireStaff } from "../_shared/cron-auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Provisionne un compte, sans mot de passe, pour chaque apprenant qui n'en a
 * pas encore : participants aux formations et inscrits LMS.
 *
 * Préalable à la fermeture de l'en-tête x-learner-email : tant qu'un apprenant
 * n'a pas de compte, son identité ne peut pas venir d'une session.
 * Idempotente et rejouable : un compte existant n'est jamais modifié.
 */
serve(async (req: Request) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  // Réservé à l'équipe (admin ou module). Une ligne profiles ne prouve rien :
  // un apprenant en a une.
  if (!(await requireStaff(req))) return createErrorResponse("Forbidden", 403);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { dryRun = false } = await req.json().catch(() => ({})) as { dryRun?: boolean };

    const [{ data: participants }, { data: enrollments }] = await Promise.all([
      admin.from("training_participants").select("email"),
      admin.from("lms_enrollments").select("learner_email"),
    ]);

    const emails = new Set<string>();
    for (const row of participants ?? []) {
      const email = (row as { email: string | null }).email?.trim().toLowerCase();
      if (email && email.includes("@")) emails.add(email);
    }
    for (const row of enrollments ?? []) {
      const email = (row as { learner_email: string | null }).learner_email?.trim().toLowerCase();
      if (email && email.includes("@")) emails.add(email);
    }

    if (dryRun) {
      return createJsonResponse({ dryRun: true, candidates: emails.size });
    }

    let created = 0;
    let existing = 0;
    const failures: string[] = [];
    for (const email of emails) {
      try {
        const result = await ensureLearnerAccount(admin, email);
        if (result.created) created += 1;
        else existing += 1;
      } catch (err) {
        console.error("[backfill-learner-accounts]", email, err);
        failures.push(email);
      }
    }

    return createJsonResponse({ candidates: emails.size, created, existing, failed: failures.length });
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : "Erreur inconnue",
      500,
      { cause: error, fn: "backfill-learner-accounts" },
    );
  }
});
