import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, createErrorResponse, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function findUserByEmail(admin: ReturnType<typeof createClient>, email: string) {
  const normalizedEmail = email.toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === normalizedEmail);
    if (user) return user;
    if (data.users.length < 1000) break;
  }
  return null;
}

serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    const { token, password } = await req.json();
    if (!token || !password) {
      return createErrorResponse("Missing token or password", 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Validate token via RPC (also marks/checks status server-side)
    const { data: preview, error: previewErr } = await admin.rpc("preview_learner_token", {
      p_token: token,
    });
    if (previewErr) throw previewErr;
    const result = preview as { status: string; email?: string; has_account?: boolean };
    if (!result || result.status === "invalid") {
      return createErrorResponse("Lien invalide.", 400);
    }
    if (result.status === "expired") {
      return createErrorResponse("Lien expiré.", 400);
    }
    const email = (result.email || "").toLowerCase();
    if (!email) {
      return createErrorResponse("Email introuvable.", 400);
    }

    // Create the auth user with admin API (bypasses signup_disabled)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "learner" },
    });

    if (createErr) {
      const msg = (createErr.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        const existingUser = await findUserByEmail(admin, email);
        if (!existingUser?.id) throw createErr;

        const { error: updateErr } = await admin.auth.admin.updateUserById(existingUser.id, {
          password,
          email_confirm: true,
          user_metadata: { ...(existingUser.user_metadata ?? {}), role: "learner" },
        });
        if (updateErr) throw updateErr;

        return new Response(
          JSON.stringify({ success: true, email, user_id: existingUser.id, updated_existing: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw createErr;
    }

    return new Response(
      JSON.stringify({ success: true, email, user_id: created.user?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return createErrorResponse(message, 500, { cause: err, fn: "create-learner-account" });
  }
});
