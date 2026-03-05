import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
} from "../_shared/cors.ts";

/**
 * Edge Function: resolve-formulaire
 *
 * Public entry point for LearnDash / WordPress form links.
 * Validates course_id (LearnDash), applies IP-based rate limiting,
 * and resolves or creates the form token.
 *
 * POST /resolve-formulaire
 * Body: { email, course_id, form_type, first_name?, last_name? }
 *
 * When first_name + last_name are provided → registers an orphan entry
 * (participant not found in any training session).
 */

const MAX_REQUESTS_PER_MINUTE = 10;
const RATE_LIMIT_WINDOW_SECONDS = 60;

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightIfNeeded(req);
  if (preflightResponse) return preflightResponse;

  if (req.method !== "POST") {
    return createErrorResponse("Method not allowed", 405);
  }

  try {
    const body = await req.json();
    const { email, course_id, form_type, first_name, last_name } = body;

    // Basic validation
    if (!email || !course_id || !form_type) {
      return createErrorResponse("Paramètres manquants : email, course_id et form_type sont requis.", 400);
    }

    const cid = typeof course_id === "number" ? course_id : parseInt(course_id, 10);
    if (isNaN(cid)) {
      return createErrorResponse("course_id invalide.", 400);
    }

    if (!["besoins", "evaluation"].includes(form_type)) {
      return createErrorResponse("form_type doit être 'besoins' ou 'evaluation'.", 400);
    }

    // Get client IP for rate limiting
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // Create Supabase client with service role (to bypass RLS for rate limiting)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check rate limit
    const { data: isAllowed, error: rateLimitError } = await supabase.rpc(
      "check_formulaire_rate_limit",
      {
        p_ip_address: clientIp,
        p_max_requests: MAX_REQUESTS_PER_MINUTE,
        p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
      }
    );

    if (rateLimitError) {
      console.error("Rate limit check error:", rateLimitError);
      // Don't block on rate limit errors, just log
    } else if (!isAllowed) {
      return createErrorResponse(
        "Trop de requêtes. Veuillez réessayer dans quelques minutes.",
        429
      );
    }

    // If first_name + last_name provided → orphan registration
    if (first_name && last_name) {
      const { data: result, error: rpcError } = await supabase.rpc(
        "register_formulaire_orphan",
        {
          p_email: email,
          p_first_name: first_name,
          p_last_name: last_name,
          p_course_id: cid,
          p_form_type: form_type,
        }
      );

      if (rpcError) {
        console.error("register_formulaire_orphan error:", rpcError);
        return createErrorResponse("Erreur technique. Veuillez réessayer.", 500);
      }

      return createJsonResponse(result);
    }

    // Standard resolution: look up participant
    const { data: result, error: rpcError } = await supabase.rpc(
      "resolve_formulaire_token",
      {
        p_email: email,
        p_course_id: cid,
        p_form_type: form_type,
      }
    );

    if (rpcError) {
      console.error("resolve_formulaire_token error:", rpcError);
      return createErrorResponse("Erreur technique. Veuillez réessayer.", 500);
    }

    return createJsonResponse(result);
  } catch (err) {
    console.error("Unexpected error:", err);
    return createErrorResponse("Erreur technique. Veuillez réessayer.", 500);
  }
});
