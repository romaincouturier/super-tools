import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAccessLevel } from "@/lib/accessLevel";

export type SignInOutcome = {
  ok: boolean;
  isStaff: boolean;
  mustChangePassword: boolean;
  hasAccess: boolean;
};

/**
 * Actions d'authentification des écrans de connexion (lot 2).
 * Les pages ne parlent pas au client Supabase directement.
 */
export function useAuthActions() {
  const signIn = useCallback(async (email: string, password: string): Promise<SignInOutcome> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return { ok: false, isStaff: false, mustChangePassword: false, hasAccess: false };
    }

    // Le routage dépend du rôle du compte, pas de la porte empruntée (RG-14).
    const [level, { data: security }] = await Promise.all([
      fetchAccessLevel(data.user.id),
      supabase
        .from("user_security_metadata")
        .select("must_change_password")
        .eq("user_id", data.user.id)
        .maybeSingle(),
    ]);

    return {
      ok: true,
      isStaff: level === "staff",
      mustChangePassword: security?.must_change_password === true,
      hasAccess: level === "staff" || level === "learner",
    };
  }, []);

  const updatePassword = useCallback(async (password: string): Promise<string | null> => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return error.message;
    // W8.5 : les sessions ouvertes ailleurs tombent, la courante est épargnée.
    await supabase.rpc("revoke_other_sessions");
    return null;
  }, []);

  /** Enregistre côté serveur qu'un mot de passe est désormais défini. */
  const markPasswordChanged = useCallback(async () => {
    await supabase.rpc("mark_password_changed");
  }, []);

  return { signIn, updatePassword, markPasswordChanged };
}

/**
 * État du lien de réinitialisation : il ouvre une session de courte durée.
 * Sans session, le lien est expiré ou a déjà servi.
 *
 * RG-21 : un lien qui consomme son jeton dès le chargement de la page reste
 * utilisable si un filtre de sécurité de messagerie l'ouvre avant l'apprenant
 * (`docs/SPEC_CONNEXION_APPRENANT.md`, chapitre 19). L'ancien format `#access_
 * token=...&type=recovery` (lien Supabase natif, action_link) le consomme au
 * chargement : c'est le cas `stage === "ready"` directement, conservé pour les
 * emails déjà envoyés. Le format `?token_hash=...&type=recovery` (construit
 * par `learnerAccessLink` et `send-password-reset` depuis `hashed_token`, sans
 * jamais visiter `auth/v1/verify`) ne consomme rien avant `confirmRecovery`,
 * appelée uniquement au clic sur "Continuer" (`stage === "confirm"`).
 */
export function usePasswordRecoverySession() {
  const [stage, setStage] = useState<"checking" | "confirm" | "ready" | "invalid">("checking");

  useEffect(() => {
    let cancelled = false;
    const hashType = new URLSearchParams(window.location.hash.substring(1)).get("type");
    const search = new URLSearchParams(window.location.search);
    const pendingTokenHash = search.get("type") === "recovery" ? search.get("token_hash") : null;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && !cancelled) setStage("ready");
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session || hashType === "recovery") { setStage("ready"); return; }
      setStage(pendingTokenHash ? "confirm" : "invalid");
    });

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  /** Consomme le jeton, uniquement appelée depuis un clic de l'apprenant. */
  const confirmRecovery = useCallback(async () => {
    const tokenHash = new URLSearchParams(window.location.search).get("token_hash");
    if (!tokenHash) { setStage("invalid"); return; }
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    // Succès : verifyOtp émet PASSWORD_RECOVERY, déjà écouté ci-dessus.
    if (error) setStage("invalid");
  }, []);

  return { stage, confirmRecovery };
}
