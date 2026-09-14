import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SignInOutcome = {
  ok: boolean;
  isStaff: boolean;
  mustChangePassword: boolean;
};

/**
 * Actions d'authentification des écrans de connexion (lot 2).
 * Les pages ne parlent pas au client Supabase directement.
 */
export function useAuthActions() {
  const signIn = useCallback(async (email: string, password: string): Promise<SignInOutcome> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { ok: false, isStaff: false, mustChangePassword: false };

    // Le routage dépend du rôle du compte, pas de la porte empruntée (RG-14).
    const [{ data: profile }, { data: security }] = await Promise.all([
      supabase.from("profiles").select("user_id").eq("user_id", data.user.id).maybeSingle(),
      supabase
        .from("user_security_metadata")
        .select("must_change_password")
        .eq("user_id", data.user.id)
        .maybeSingle(),
    ]);

    return {
      ok: true,
      isStaff: !!profile,
      mustChangePassword: security?.must_change_password === true,
    };
  }, []);

  const updatePassword = useCallback(async (password: string): Promise<string | null> => {
    const { error } = await supabase.auth.updateUser({ password });
    return error ? error.message : null;
  }, []);

  return { signIn, updatePassword };
}

/**
 * État du lien de réinitialisation : il ouvre une session de courte durée.
 * Sans session, le lien est expiré ou a déjà servi.
 */
export function usePasswordRecoverySession() {
  const [stage, setStage] = useState<"checking" | "ready" | "invalid">("checking");

  useEffect(() => {
    let cancelled = false;
    const hashType = new URLSearchParams(window.location.hash.substring(1)).get("type");

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && !cancelled) setStage("ready");
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      setStage(session || hashType === "recovery" ? "ready" : "invalid");
    });

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  return stage;
}
