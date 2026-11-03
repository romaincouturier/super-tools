import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { normalizeLearnerEmail, isUsableLearnerEmail } from "./learner-email.ts";
import { generateHash } from "./crypto.ts";
import { getAppUrls } from "./app-urls.ts";
import { passwordResetLink } from "./password-reset.ts";
import { getSigniticSignature } from "./signitic.ts";
import { getBccList } from "./email-settings.ts";
import { sendEmail } from "./resend.ts";
import { wrapEmailHtml } from "./templates.ts";
import { renderEditableEmail, ctaButton } from "./editable-email.ts";
import { EDITABLE_EMAIL_DEFAULTS } from "./editable-email-defaults.ts";

export class LearnerAccessError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
    this.name = "LearnerAccessError";
  }
}

/**
 * Provisionne le compte apprenant d'une adresse, sans mot de passe (W12).
 *
 * Appelée au moment de l'inscription ou de l'encaissement : le compte existe
 * avant même que l'apprenant clique sur son lien. Le mot de passe reste
 * facultatif, et un compte déjà présent n'est jamais modifié (S1).
 */
export async function ensureLearnerAccount(
  admin: SupabaseClient,
  email: string,
): Promise<{ created: boolean; userId: string | null }> {
  // RG-01 et RG-18 : une seule règle de normalisation, une seule règle de
  // validité, partagées par toutes les fonctions qui provisionnent un compte.
  const normalized = normalizeLearnerEmail(email);
  if (!isUsableLearnerEmail(normalized)) return { created: false, userId: null };

  const { data: created, error } = await admin.auth.admin.createUser({
    email: normalized,
    email_confirm: true,
    user_metadata: { role: "learner" },
  });

  if (error) {
    const message = (error.message || "").toLowerCase();
    const exists = message.includes("already") || message.includes("registered") || message.includes("exists");
    if (exists) return { created: false, userId: null };
    throw error;
  }

  const userId = created.user?.id ?? null;
  if (userId) {
    // Sans mot de passe : la résolution d'identité aiguillera vers le lien.
    await admin
      .from("user_security_metadata")
      .upsert({ user_id: userId, password_set: false }, { onConflict: "user_id" });
  }

  return { created: true, userId };
}

/**
 * Construit le lien d'accès à l'espace apprenant, sans jamais ouvrir de
 * session automatiquement (plus de lien magique). Le lien varie selon l'état
 * du compte, lu via learner_password_set (RPC) :
 *  - password_set = false  : lien vers ConnexionReinitialisation.tsx, porteur
 *    du token_hash Supabase (RG-21 : jamais l'action_link, qui consommerait
 *    le jeton dès la requête GET vers auth/v1/verify — voir verifyOtp côté
 *    frontend, déclenché seulement par le clic de l'apprenant).
 *  - password_set = true   : lien qui préremplit seulement l'adresse sur
 *    /connexion, aucune authentification automatique.
 * Renvoie null si l'adresse ne correspond à aucun compte, pour ne rien
 * révéler à l'appelant.
 */
export async function learnerAccessLink(
  admin: SupabaseClient,
  email: string,
  strict = false,
): Promise<{ actionLink: string; passwordSet: boolean } | null> {
  const normalized = normalizeLearnerEmail(email);
  if (!isUsableLearnerEmail(normalized)) return null;

  const { data: passwordSet, error } = await admin.rpc("learner_password_set", { p_email: normalized });
  if (error && strict) throw new LearnerAccessError("État du compte apprenant indisponible : réessayez plus tard.");
  if (error) return null;
  if (passwordSet === null) return null;

  if (passwordSet === false) {
    const actionLink = await passwordResetLink(admin, normalized, strict);
    return actionLink ? { actionLink, passwordSet: false } : null;
  }

  const urls = await getAppUrls();
  return {
    actionLink: `${urls.app_url}/connexion?email=${encodeURIComponent(normalized)}`,
    passwordSet: true,
  };
}

/**
 * Envoie l'email générique d'accès à l'espace apprenant (RG-08 : même quota
 * que send-password-reset). Pour un email au contenu spécifique (relance,
 * erratum...) qui a seulement besoin du lien, utiliser learnerAccessLink
 * directement plutôt que cette fonction.
 */
export async function sendLearnerAccessEmail(
  admin: SupabaseClient,
  email: string,
  opts: { trainingName?: string | null; ip?: string; strict?: boolean; quotaExempt?: boolean } = {},
): Promise<{ sent: boolean }> {
  const normalized = normalizeLearnerEmail(email);
  if (!isUsableLearnerEmail(normalized)) return { sent: false };

  if (!opts.quotaExempt) {
    const emailHash = await generateHash(normalized);
    const { data: allowed, error: quotaError } = await admin.rpc("check_link_quota", {
      p_email_hash: emailHash,
      p_ip: opts.ip ?? "unknown",
    });
    if (quotaError || allowed !== true) {
      if (opts.strict) {
        if (quotaError || allowed !== false) throw new LearnerAccessError("Vérification du quota indisponible : aucun email envoyé, réessayez plus tard.");
        throw new LearnerAccessError("Quota interne atteint : 3 demandes d’accès maximum par adresse sur une heure (10 par adresse IP). Aucun nouvel email envoyé ; réessayez après expiration des demandes précédentes.", 429);
      }
      return { sent: false };
    }
  }

  const link = await learnerAccessLink(admin, normalized, opts.strict);
  if (!link) {
    if (opts.strict) throw new LearnerAccessError("Lien d’accès indisponible pour ce compte : aucun email envoyé.");
    return { sent: false };
  }

  const cta = link.passwordSet ? "Accéder à mon espace" : "Créer mon mot de passe";
  const tpl = EDITABLE_EMAIL_DEFAULTS.learner_access;
  const rendered = await renderEditableEmail(admin, {
    type: "learner_access",
    defaultSubject: tpl.subject.vous,
    defaultContent: tpl.content.vous,
    vars: {
      training_name: opts.trainingName ?? null,
      password_set: link.passwordSet || null,
      no_password: link.passwordSet ? null : true,
    },
    blocks: { access_button: ctaButton(cta, link.actionLink) },
  });

  const signature = await getSigniticSignature();
  const html = wrapEmailHtml(rendered.html, signature);
  const subject = rendered.subject;

  const bccList = await getBccList();
  const result = await sendEmail({
    to: normalized,
    bcc: bccList,
    subject,
    html,
    _emailType: "learner_access_email",
  });

  if (!result.success && opts.strict) {
    throw new LearnerAccessError(`Envoi de l’email d’accès refusé : ${result.error ?? "erreur du service d’envoi"}. Consultez les emails en échec avant de relancer.`);
  }
  return { sent: result.success };
}

export async function sendRegisteredLearnerAccessEmail(
  admin: SupabaseClient,
  email: string,
  opts: { trainingName?: string | null; ip?: string; callerId?: string } = {},
): Promise<{ sent: boolean }> {
  const normalized = normalizeLearnerEmail(email);
  if (!isUsableLearnerEmail(normalized)) throw new Error("Email invalide");
  const { data: known, error } = await admin.rpc("is_known_learner", { p_email: normalized });
  if (error) throw error;
  if (!known) throw new Error("Cette adresse ne correspond à aucune inscription apprenante");
  let quotaExempt = false;
  if (opts.callerId) {
    const { data: isAdmin, error: adminError } = await admin.rpc("is_admin", { _user_id: opts.callerId });
    if (adminError) throw new LearnerAccessError("Vérification des droits administrateur indisponible : aucun email envoyé.");
    quotaExempt = isAdmin === true;
  }
  await ensureLearnerAccount(admin, normalized);
  const result = await sendLearnerAccessEmail(admin, normalized, { ...opts, strict: true, quotaExempt });
  if (!result.sent) throw new Error("L'email d'accès n'a pas été envoyé : vérifiez le quota et la création du lien");
  return result;
}
