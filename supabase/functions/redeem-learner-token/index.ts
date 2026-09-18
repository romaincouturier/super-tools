import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  createErrorResponse,
  createJsonResponse,
  handleCorsPreflightIfNeeded,
} from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Échange un jeton d'accès apprenant contre une ouverture de session (W5).
 *
 * Le lien reçu par email connecte : il ne demande pas de mot de passe. La
 * fonction valide le jeton, provisionne le compte s'il n'existe pas encore,
 * puis rend l'empreinte à usage unique que le navigateur échange contre une
 * session. Elle ne redéfinit jamais le mot de passe d'un compte existant (S1).
 */
serve(async (req: Request) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    const { token } = await req.json() as { token?: string };
    if (!token) return createErrorResponse("missing_token", 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: preview, error: previewErr } = await admin.rpc("preview_learner_token", {
      p_token: token,
    });
    if (previewErr) {
      return createErrorResponse(previewErr.message, 500, { cause: previewErr, fn: "redeem-learner-token" });
    }

    const result = preview as { status?: string; email?: string; training_id?: string | null } | null;
    const status = result?.status ?? "invalid";
    if (status !== "ok") {
      // "invalid", "expired" ou "used" : l'écran porte l'action de reprise (W10).
      return createJsonResponse({ status });
    }

    const email = (result?.email ?? "").toLowerCase();
    if (!email) return createJsonResponse({ status: "invalid" });

    // Provisionnement si le compte n'existe pas encore : sans mot de passe.
    const { error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { role: "learner" },
    });
    let created = !createErr;
    if (createErr) {
      const message = (createErr.message || "").toLowerCase();
      const alreadyExists = message.includes("already") || message.includes("registered") || message.includes("exists");
      if (!alreadyExists) {
        return createErrorResponse(createErr.message, 500, { cause: createErr, fn: "redeem-learner-token" });
      }
      created = false;
    }

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkErr || !link?.properties?.hashed_token) {
      return createErrorResponse(linkErr?.message ?? "link_failed", 500, {
        cause: linkErr,
        fn: "redeem-learner-token",
      });
    }

    // Un compte tout juste provisionné n'a pas de mot de passe : le drapeau le
    // dit, pour que la résolution d'identité aiguille vers le lien (chapitre 6.2).
    if (created && link.user?.id) {
      await admin.from("user_security_metadata").upsert(
        { user_id: link.user.id, password_set: false },
        { onConflict: "user_id" },
      );
    }

    // Destination : la formation concernée quand le jeton en porte une, sinon
    // le tableau de bord (critères 8 et 14).
    let next: string | null = null;
    if (result?.training_id) {
      const { data: training } = await admin
        .from("trainings")
        .select("supports_lms_course_id")
        .eq("id", result.training_id)
        .maybeSingle();
      const courseId = (training as { supports_lms_course_id?: string | null } | null)?.supports_lms_course_id;
      if (courseId) next = `/lms/${courseId}/home`;
    }

    return createJsonResponse({
      status: "ok",
      email,
      token_hash: link.properties.hashed_token,
      training_id: result?.training_id ?? null,
      next,
    });
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : "Erreur inconnue",
      500,
      { cause: error, fn: "redeem-learner-token" },
    );
  }
});
