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

export type LearnerAccessEmailKind = "create_password" | "course_access" | "space_access";

/**
 * Choix du mail d'accès (règle validée le 04/11/2026) :
 *  - aucun mot de passe prouvé (password_set faux ou ligne absente) : création
 *    du mot de passe, même pour un compte existant ;
 *  - mot de passe défini et formation connue : « accès à la formation ouvert » ;
 *  - mot de passe défini sans formation : simple accès à l'espace.
 * Une connexion passée ne compte pas : un lien magique ne prouve rien.
 */
export function decideLearnerAccessEmail(state: { passwordSet: boolean; hasTraining: boolean }): LearnerAccessEmailKind {
  if (!state.passwordSet) return "create_password";
  return state.hasTraining ? "course_access" : "space_access";
}

/** Formation et cours LMS rattaché, pour nommer la formation et lier le cours. */
export async function resolveTrainingAccess(
  admin: SupabaseClient,
  trainingId: string | null | undefined,
): Promise<{ trainingName: string | null; courseId: string | null }> {
  if (!trainingId) return { trainingName: null, courseId: null };
  const { data } = await admin
    .from("trainings")
    .select("training_name, supports_lms_course_id")
    .eq("id", trainingId)
    .maybeSingle();
  return {
    trainingName: (data as { training_name?: string | null } | null)?.training_name ?? null,
    courseId: (data as { supports_lms_course_id?: string | null } | null)?.supports_lms_course_id ?? null,
  };
}

/**
 * Envoie l'email d'accès à l'espace apprenant (RG-08 : même quota que
 * send-password-reset), choisi par decideLearnerAccessEmail. Pour un email au
 * contenu spécifique (relance, erratum...) qui a seulement besoin du lien,
 * utiliser learnerAccessLink directement plutôt que cette fonction.
 */
export async function sendLearnerAccessEmail(
  admin: SupabaseClient,
  email: string,
  opts: {
    trainingName?: string | null;
    courseId?: string | null;
    accountCreated?: boolean;
    ip?: string;
    strict?: boolean;
    quotaExempt?: boolean;
  } = {},
): Promise<{ sent: boolean; kind?: LearnerAccessEmailKind }> {
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

  const trainingName = opts.trainingName ?? null;
  const kind = decideLearnerAccessEmail({ passwordSet: link.passwordSet, hasTraining: !!trainingName });

  let rendered: { html: string; subject: string };
  if (kind === "course_access") {
    const urls = await getAppUrls();
    const target = opts.courseId
      ? `${urls.app_url}/lms/${encodeURIComponent(opts.courseId)}/home?email=${encodeURIComponent(normalized)}`
      : `${urls.app_url}/espace-apprenant`;
    const tpl = EDITABLE_EMAIL_DEFAULTS.learner_course_access;
    rendered = await renderEditableEmail(admin, {
      type: "learner_course_access",
      defaultSubject: tpl.subject.vous,
      defaultContent: tpl.content.vous,
      vars: { training_name: trainingName },
      blocks: {
        access_button: ctaButton("Accéder à ma formation", target),
        forgot_password_link: `<a href="${urls.app_url}/connexion?email=${encodeURIComponent(normalized)}">Mot de passe oublié ?</a>`,
      },
    });
  } else {
    const cta = kind === "space_access" ? "Accéder à mon espace" : "Créer mon mot de passe";
    const tpl = EDITABLE_EMAIL_DEFAULTS.learner_access;
    rendered = await renderEditableEmail(admin, {
      type: "learner_access",
      defaultSubject: tpl.subject.vous,
      defaultContent: tpl.content.vous,
      vars: {
        training_name: trainingName,
        password_set: link.passwordSet || null,
        no_password: link.passwordSet ? null : true,
        // Compte déjà existant sans mot de passe : la plateforme a changé.
        platform_changed: !link.passwordSet && opts.accountCreated !== true ? true : null,
      },
      blocks: { access_button: ctaButton(cta, link.actionLink) },
    });
  }

  const signature = await getSigniticSignature();
  const html = wrapEmailHtml(rendered.html, signature);
  const subject = rendered.subject;

  const bccList = await getBccList();
  const result = await sendEmail({
    to: normalized,
    bcc: bccList,
    subject,
    html,
    _emailType: kind === "course_access" ? "learner_course_access_email" : "learner_access_email",
  });

  if (!result.success && opts.strict) {
    throw new LearnerAccessError(`Envoi de l’email d’accès refusé : ${result.error ?? "erreur du service d’envoi"}. Consultez les emails en échec avant de relancer.`);
  }
  return { sent: result.success, kind };
}

export async function sendRegisteredLearnerAccessEmail(
  admin: SupabaseClient,
  email: string,
  opts: { trainingName?: string | null; courseId?: string | null; ip?: string; callerId?: string } = {},
): Promise<{ sent: boolean; kind?: LearnerAccessEmailKind; accountCreated: boolean }> {
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
  const { created } = await ensureLearnerAccount(admin, normalized);
  const result = await sendLearnerAccessEmail(admin, normalized, { ...opts, accountCreated: created, strict: true, quotaExempt });
  if (!result.sent) throw new Error("L'email d'accès n'a pas été envoyé : vérifiez le quota et la création du lien");
  return { ...result, accountCreated: created };
}
