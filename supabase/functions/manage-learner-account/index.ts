import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
} from "../_shared/cors.ts";

import { getSigniticSignature, wrapEmailHtml, sendEmail, getAppUrls } from "../_shared/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Masque une adresse pour l'annoncer sans la divulguer entièrement. */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const head = local.slice(0, 2);
  return `${head}${"*".repeat(Math.max(local.length - 2, 1))}@${domain}`;
}

/**
 * Deux messages (E-F du chapitre 11) : confirmation vers la nouvelle adresse,
 * alerte de sécurité vers l'ancienne.
 */
async function notifyEmailChange(oldEmail: string, newEmail: string): Promise<void> {
  try {
    const [signature, urls] = await Promise.all([getSigniticSignature(), getAppUrls()]);
    const loginUrl = `${urls.app_url}/connexion`;

    await sendEmail({
      to: newEmail,
      subject: "Votre nouvelle adresse de connexion",
      html: wrapEmailHtml(
        `<p>Bonjour,</p>
         <p>L'adresse de votre espace apprenant est désormais <strong>${newEmail}</strong>.
         Vos formations et votre progression sont inchangées.</p>
         <p><a href="${loginUrl}">Me connecter</a></p>
         <p>Vous n'avez pas de mot de passe à créer : indiquez votre adresse, nous vous
         enverrons un lien de connexion.</p>`,
        signature,
      ),
      _emailType: "learner_email_changed",
    });

    await sendEmail({
      to: oldEmail,
      subject: "L'adresse de votre compte a été modifiée",
      html: wrapEmailHtml(
        `<p>Bonjour,</p>
         <p>L'adresse de connexion de votre espace apprenant a été remplacée par
         <strong>${maskEmail(newEmail)}</strong>. Les liens envoyés à cette ancienne
         adresse ne fonctionnent plus.</p>
         <p>Si vous n'êtes pas à l'origine de ce changement, écrivez-nous immédiatement à
         <a href="mailto:contact@supertilt.fr">contact@supertilt.fr</a>.</p>`,
        signature,
      ),
      _emailType: "learner_email_changed_notice",
    });
  } catch (err) {
    // L'adresse est déjà changée : un échec d'envoi ne doit pas annuler l'opération.
    console.error("[manage-learner-account] notifyEmailChange:", err);
  }
}

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
  if (authErr || !caller) {
    return createErrorResponse("Forbidden", 403);
  }
  // Server-side authorization (user_metadata is user-writable and unsafe).
  // Admins, and users granted the "lms" module, can manage learner accounts.
  const [{ data: isAdm }, { data: hasLms }] = await Promise.all([
    admin.rpc("is_admin", { _user_id: caller.id }),
    admin.rpc("has_module_access", { _user_id: caller.id, _module: "lms" }),
  ]);
  if (!isAdm && !hasLms) {
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
      const newEmail = (email ?? "").trim().toLowerCase();
      if (!newEmail) return createErrorResponse("Email requis", 400);

      // W13 : l'adresse est la clé de rattachement du portail. Elle bouge dans
      // tous les référentiels d'un coup, sinon l'apprenant perd ses formations.
      const { data: existing, error: readErr } = await admin.auth.admin.getUserById(user_id);
      if (readErr || !existing?.user?.email) {
        return createErrorResponse("Compte introuvable", 404);
      }
      const oldEmail = existing.user.email.toLowerCase();
      if (oldEmail === newEmail) {
        return createJsonResponse({ success: true, unchanged: true });
      }

      const { data: moved, error: moveErr } = await callerClient.rpc("change_learner_email", {
        p_old_email: oldEmail,
        p_new_email: newEmail,
        p_user_id: user_id,
      });
      if (moveErr) return createErrorResponse(moveErr.message, 400, { cause: moveErr });

      const { error } = await admin.auth.admin.updateUserById(user_id, {
        email: newEmail,
        email_confirm: true,
      });
      if (error) throw error;

      await notifyEmailChange(oldEmail, newEmail);

      return createJsonResponse({ success: true, moved });
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
    return createErrorResponse(message, 500);
  }
});
