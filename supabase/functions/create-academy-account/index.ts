import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  createErrorResponse,
  createJsonResponse,
  handleCorsPreflightIfNeeded,
} from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return createErrorResponse("Configuration serveur indisponible", 500, { fn: "create-academy-account" });
    }
    const body = await req.json() as {
      email?: string;
      password?: string;
      fullName?: string;
    };
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    const fullName = body.fullName?.trim() ?? "";

    if (!isValidEmail(email) || password.length < 8 || !fullName) {
      return createErrorResponse("Veuillez renseigner tous les champs avec un mot de passe d'au moins 8 caractères.", 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Le choix des formations se fait après la création du compte (écran
    // /academy/choisir-mes-formations, via enroll-academy-courses) : cette
    // fonction ne fait plus que créer le compte.
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: "learner" },
    });

    if (createError) {
      const message = createError.message.toLowerCase();
      if (message.includes("already") || message.includes("registered") || message.includes("exists")) {
        return createErrorResponse("already_exists", 409);
      }
      return createErrorResponse(createError.message, 500, { cause: createError, fn: "create-academy-account" });
    }

    return createJsonResponse({ success: true, email });
  } catch (error) {
    return createErrorResponse(error instanceof Error ? error.message : "Erreur inconnue", 500, {
      cause: error,
      fn: "create-academy-account",
    });
  }
});
