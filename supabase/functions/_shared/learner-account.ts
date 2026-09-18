import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { normalizeLearnerEmail, isUsableLearnerEmail } from "./learner-email.ts";
import { generateHash } from "./crypto.ts";
import { getAppUrls } from "./app-urls.ts";
import { getSigniticSignature } from "./signitic.ts";
import { getBccList } from "./email-settings.ts";
import { sendEmail } from "./resend.ts";
import { wrapEmailHtml, emailButton } from "./templates.ts";

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
): Promise<{ actionLink: string; passwordSet: boolean } | null> {
  const normalized = normalizeLearnerEmail(email);
  if (!isUsableLearnerEmail(normalized)) return null;

  const { data: passwordSet } = await admin.rpc("learner_password_set", { p_email: normalized });
  if (passwordSet === null) return null;

  const urls = await getAppUrls();
  if (passwordSet === false) {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: normalized,
      options: { redirectTo: `${urls.app_url}/connexion/reinitialisation` },
    });
    if (error || !data?.properties?.hashed_token) return null;
    const tokenHash = encodeURIComponent(data.properties.hashed_token);
    return {
      actionLink: `${urls.app_url}/connexion/reinitialisation?token_hash=${tokenHash}&type=recovery`,
      passwordSet: false,
    };
  }

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
  opts: { trainingName?: string | null; ip?: string } = {},
): Promise<{ sent: boolean }> {
  const normalized = normalizeLearnerEmail(email);
  if (!isUsableLearnerEmail(normalized)) return { sent: false };

  const emailHash = await generateHash(normalized);
  const { data: allowed } = await admin.rpc("check_link_quota", {
    p_email_hash: emailHash,
    p_ip: opts.ip ?? "unknown",
  });
  if (allowed === false) return { sent: false };

  const link = await learnerAccessLink(admin, normalized);
  if (!link) return { sent: false };

  const trainingLabel = opts.trainingName ? ` pour la formation « ${opts.trainingName} »` : "";
  const cta = link.passwordSet ? "Accéder à mon espace" : "Créer mon mot de passe";
  const subject = link.passwordSet ? "Accéder à votre espace SuperTools" : "Créez votre mot de passe SuperTools";
  const intro = link.passwordSet
    ? `Bonjour,</p><p>Votre espace apprenant${trainingLabel} est prêt. Connectez-vous avec votre adresse et votre mot de passe.`
    : `Bonjour,</p><p>Votre espace apprenant${trainingLabel} est prêt. Créez votre mot de passe pour y accéder.`;

  const signature = await getSigniticSignature();
  const html = wrapEmailHtml(
    [`<p>${intro}</p>`, emailButton(cta, link.actionLink)].join("\n"),
    signature,
  );

  const bccList = await getBccList();
  const result = await sendEmail({
    to: normalized,
    bcc: bccList,
    subject,
    html,
    _emailType: "learner_access_email",
  });

  return { sent: result.success };
}
