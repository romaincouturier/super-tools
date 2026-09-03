import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { createErrorResponse, createJsonResponse, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return createErrorResponse("Configuration serveur indisponible", 500, { fn: "get-academy-catalog" });
    }
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: courses, error } = await admin
      .from("lms_courses")
      .select("id, title, description, cover_image_url, estimated_duration_minutes, access_type, expertise, is_featured, formation_config_id, formation_configs(formation_name, supertilt_link, prix, duree_heures)")
      .eq("status", "published")
      .in("access_type", ["gratuit", "payant"])
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) return createErrorResponse(error.message, 500, { cause: error, fn: "get-academy-catalog" });

    return createJsonResponse({ courses: courses ?? [] });
  } catch (error) {
    return createErrorResponse(error instanceof Error ? error.message : "Erreur inconnue", 500, {
      cause: error,
      fn: "get-academy-catalog",
    });
  }
});
