import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { handleCorsPreflightIfNeeded, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";
import { requireStaff } from "../_shared/cron-auth.ts";
import { sendLearnerAccessEmail } from "../_shared/learner-account.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Renvoi manuel de l'email d'accès apprenant, depuis la fiche participant.
 * Réservé au staff : contrairement à l'ancien lien magique, cette fonction
 * n'est jamais appelée depuis /connexion ni par un visiteur anonyme.
 */
serve(async (req: Request) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  if (!(await requireStaff(req))) return createErrorResponse("Forbidden", 403);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { email, trainingId } = await req.json();
    if (!email) return createErrorResponse("Email requis", 400);

    let trainingName: string | null = null;
    if (trainingId) {
      const { data: training } = await admin
        .from("trainings").select("training_name").eq("id", trainingId).maybeSingle();
      trainingName = training?.training_name ?? null;
    }

    const { sent } = await sendLearnerAccessEmail(admin, email, { trainingName });
    return createJsonResponse({ success: true, sent });
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : "Erreur inconnue",
      500,
      { cause: error, fn: "send-learner-access-email" },
    );
  }
});
