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
 * Envoie l'email d'accès à l'espace apprenant, sans jamais ouvrir de session
 * automatiquement (plus de lien magique). Le lien varie selon l'état du
 * compte, lu via learner_password_set (RPC) :
 *  - password_set = false  : lien "recovery" natif Supabase, mène à la
 *    création d'un vrai mot de passe (réutilise le circuit de
 *    ConnexionReinitialisation.tsx, déjà en place pour "mot de passe oublié").
 *  - password_set = true   : lien qui préremplit seulement l'adresse sur
 *    /connexion, aucune authentification automatique.
 * Silencieux si l'adresse ne correspond à aucun compte ou dépasse le quota
 * RG-08 (mêmes règles que send-password-reset), pour ne rien révéler.
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

  const { data: passwordSet } = await admin.rpc("learner_password_set", { p_email: normalized });
  if (passwordSet === null) return { sent: false };

  const urls = await getAppUrls();
  const trainingLabel = opts.trainingName ? ` pour la formation « ${opts.trainingName} »` : "";
  let actionLink: string;
  let cta: string;
  let subject: string;
  let intro: string;

  if (passwordSet === false) {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: normalized,
      options: { redirectTo: `${urls.app_url}/connexion/reinitialisation?mode=activation` },
    });
    if (error || !data?.properties?.action_link) return { sent: false };
    actionLink = data.properties.action_link;
    cta = "Créer mon mot de passe";
    subject = "Créez votre mot de passe SuperTools";
    intro = `Bonjour,</p><p>Votre espace apprenant${trainingLabel} est prêt. Créez votre mot de passe pour y accéder.`;
  } else {
    actionLink = `${urls.app_url}/connexion?email=${encodeURIComponent(normalized)}`;
    cta = "Accéder à mon espace";
    subject = "Accéder à votre espace SuperTools";
    intro = `Bonjour,</p><p>Votre espace apprenant${trainingLabel} est prêt. Connectez-vous avec votre adresse et votre mot de passe.`;
  }

  const signature = await getSigniticSignature();
  const html = wrapEmailHtml(
    [`<p>${intro}</p>`, emailButton(cta, actionLink)].join("\n"),
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
