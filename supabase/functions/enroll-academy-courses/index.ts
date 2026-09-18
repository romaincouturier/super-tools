import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { handleCorsPreflightIfNeeded, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/supabase-client.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Inscrit l'apprenant authentifié à une ou plusieurs formations gratuites
 * (écran /academy/choisir-mes-formations, après création de compte). L'email
 * vient du jeton vérifié côté serveur, jamais du corps de la requête : un
 * appelant ne peut inscrire que lui-même.
 */
serve(async (req: Request) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  const user = await verifyAuth(req);
  if (!user?.email) return createErrorResponse("Unauthorized", 401);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { courseIds } = await req.json() as { courseIds?: string[] };
    const ids = Array.from(new Set((courseIds ?? []).filter((id) => typeof id === "string" && id)));
    if (ids.length === 0) return createErrorResponse("Au moins une formation est requise", 400);

    const { data: courses, error: coursesError } = await admin
      .from("lms_courses")
      .select("id")
      .in("id", ids)
      .eq("status", "published")
      .eq("access_type", "gratuit");
    if (coursesError) {
      return createErrorResponse(coursesError.message, 500, { cause: coursesError, fn: "enroll-academy-courses" });
    }

    const validIds = (courses ?? []).map((c) => c.id as string);
    if (validIds.length === 0) return createErrorResponse("Aucune de ces formations n'est disponible", 400);

    const email = user.email.trim().toLowerCase();
    const { error: enrollError } = await admin
      .from("lms_enrollments")
      .upsert(
        validIds.map((courseId) => ({ course_id: courseId, learner_email: email })),
        { onConflict: "course_id,learner_email" },
      );
    if (enrollError) {
      return createErrorResponse(enrollError.message, 500, { cause: enrollError, fn: "enroll-academy-courses" });
    }

    return createJsonResponse({ success: true, enrolled: validIds });
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : "Erreur inconnue",
      500,
      { cause: error, fn: "enroll-academy-courses" },
    );
  }
});
