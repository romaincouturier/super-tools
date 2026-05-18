import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  corsHeaders,
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
} from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  // Require authenticated admin caller
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return createErrorResponse("Unauthorized", 401);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify caller is an authenticated (non-learner) user
  const callerClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser();
  if (authErr || !caller || caller.user_metadata?.role === "learner") {
    return createErrorResponse("Forbidden", 403);
  }

  try {
    const body = await req.json();
    const { action } = body as { action: string };

    if (action === "list") {
      // List all learner accounts (role=learner in user_metadata)
      const learners: {
        id: string;
        email: string;
        created_at: string;
        last_sign_in_at: string | null;
        banned: boolean;
      }[] = [];

      for (let page = 1; page <= 20; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        for (const u of data.users) {
          if (u.user_metadata?.role === "learner") {
            learners.push({
              id: u.id,
              email: u.email ?? "",
              created_at: u.created_at,
              last_sign_in_at: u.last_sign_in_at ?? null,
              banned: !!(u as unknown as { banned_until?: string }).banned_until,
            });
          }
        }
        if (data.users.length < 1000) break;
      }

      return createJsonResponse({ learners });
    }

    if (action === "disable") {
      const { user_id } = body as { user_id: string };
      const { error } = await admin.auth.admin.updateUserById(user_id, {
        ban_duration: "876600h", // ~100 years
      });
      if (error) throw error;
      return createJsonResponse({ success: true });
    }

    if (action === "enable") {
      const { user_id } = body as { user_id: string };
      const { error } = await admin.auth.admin.updateUserById(user_id, {
        ban_duration: "none",
      });
      if (error) throw error;
      return createJsonResponse({ success: true });
    }

    if (action === "update_email") {
      const { user_id, email } = body as { user_id: string; email: string };
      if (!email?.trim()) return createErrorResponse("Email requis", 400);
      const { error } = await admin.auth.admin.updateUserById(user_id, {
        email: email.trim().toLowerCase(),
        email_confirm: true,
      });
      if (error) throw error;
      return createJsonResponse({ success: true });
    }

    if (action === "delete") {
      const { user_id } = body as { user_id: string };
      const { error } = await admin.auth.admin.deleteUser(user_id);
      if (error) throw error;
      return createJsonResponse({ success: true });
    }

    return createErrorResponse("Action inconnue", 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur interne";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
