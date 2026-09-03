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
      courseId?: string;
      email?: string;
      password?: string;
      fullName?: string;
    };
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    const fullName = body.fullName?.trim() ?? "";
    const courseId = body.courseId?.trim() ?? "";

    if (!courseId || !isValidEmail(email) || password.length < 8 || !fullName) {
      return createErrorResponse("Veuillez renseigner tous les champs avec un mot de passe d'au moins 8 caractères.", 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: course, error: courseError } = await admin
      .from("lms_courses")
      .select("id, access_type, expertise, status")
      .eq("id", courseId)
      .maybeSingle();

    if (courseError) return createErrorResponse(courseError.message, 500, { cause: courseError, fn: "create-academy-account" });
    if (!course || course.status !== "published" || course.access_type !== "gratuit" || course.expertise === "intra_clients") {
      return createErrorResponse("Cette formation gratuite n'est plus disponible.", 400);
    }

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

    const userId = created.user?.id;
    const { error: enrollmentError } = await admin
      .from("lms_enrollments")
      .upsert({ course_id: courseId, learner_email: email }, { onConflict: "course_id,learner_email" });

    if (enrollmentError) {
      if (userId) await admin.auth.admin.deleteUser(userId);
      return createErrorResponse(enrollmentError.message, 500, { cause: enrollmentError, fn: "create-academy-account" });
    }

    return createJsonResponse({ success: true, email, courseId });
  } catch (error) {
    return createErrorResponse(error instanceof Error ? error.message : "Erreur inconnue", 500, {
      cause: error,
      fn: "create-academy-account",
    });
  }
});
