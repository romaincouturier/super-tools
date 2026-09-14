import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fournisseur unique de l'état de session (lot 2 de la refonte de connexion,
 * docs/SPEC_CONNEXION_APPRENANT.md chapitre 8).
 *
 * Règles tenues ici :
 * - la session est résolue une seule fois, au-dessus du routeur ;
 * - aucune redirection n'est émise depuis ce fournisseur ni depuis un hook de
 *   données : seules les gardes de route naviguent ;
 * - tant que le statut vaut "loading", aucune garde ne décide ;
 * - un rafraîchissement de jeton n'est pas une déconnexion.
 */
export type SessionStatus = "loading" | "anon" | "learner" | "staff";

export type SessionState = {
  status: SessionStatus;
  user: User | null;
  email: string | null;
  isStaff: boolean;
  mustChangePassword: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const SessionContext = createContext<SessionState | null>(null);

/** Délai au-delà duquel on cesse d'attendre la résolution initiale. */
const RESOLVE_TIMEOUT_MS = 8000;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const mounted = useRef(true);

  const resolve = useCallback(async (nextUser: User | null) => {
    if (!nextUser) {
      if (!mounted.current) return;
      setUser(null);
      setIsStaff(false);
      setMustChangePassword(false);
      setStatus("anon");
      return;
    }

    // Identité stable : même objet tant que c'est le même compte, pour ne pas
    // relancer les effets qui en dépendent à chaque rafraîchissement de jeton.
    setUser((prev) => (prev && prev.id === nextUser.id ? prev : nextUser));

    const [{ data: profile }, { data: security }] = await Promise.all([
      supabase.from("profiles").select("user_id").eq("user_id", nextUser.id).maybeSingle(),
      supabase
        .from("user_security_metadata")
        .select("must_change_password")
        .eq("user_id", nextUser.id)
        .maybeSingle(),
    ]);

    if (!mounted.current) return;
    setIsStaff(!!profile);
    setMustChangePassword(security?.must_change_password === true);
    setStatus(profile ? "staff" : "learner");
  }, []);

  useEffect(() => {
    mounted.current = true;

    const timeout = window.setTimeout(() => {
      if (mounted.current) setStatus((s) => (s === "loading" ? "anon" : s));
    }, RESOLVE_TIMEOUT_MS);

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => resolve(session?.user ?? null))
      .catch(() => {
        if (mounted.current) setStatus("anon");
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted.current) return;
      if (event === "SIGNED_OUT") {
        void resolve(null);
        return;
      }
      // TOKEN_REFRESHED et USER_UPDATED ne changent pas l'identité : on ne
      // repasse pas par "loading", ce qui éviterait tout clignotement de garde.
      if (session?.user) void resolve(session.user);
    });

    return () => {
      mounted.current = false;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [resolve]);

  const refresh = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    await resolve(session?.user ?? null);
  }, [resolve]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    await resolve(null);
  }, [resolve]);

  const value = useMemo<SessionState>(
    () => ({
      status,
      user,
      email: user?.email?.toLowerCase() ?? null,
      isStaff,
      mustChangePassword,
      refresh,
      signOut,
    }),
    [status, user, isStaff, mustChangePassword, refresh, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
