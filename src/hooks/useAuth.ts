import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/hooks/useSession";

interface UseAuthOptions {
  /** Porte de connexion utilisée après une déconnexion explicite. */
  redirectTo?: string;
  /** Conservé pour compatibilité : la contrainte est portée par la garde de route. */
  checkPasswordChange?: boolean;
  /** Conservé pour compatibilité : ce hook ne redirige plus de lui-même. */
  disableRedirect?: boolean;
}

/**
 * Accès en lecture à la session (lot 2 de la refonte de connexion).
 *
 * Ce hook ne navigue plus, sauf sur une déconnexion demandée par l'utilisateur.
 * Les redirections sont émises par les gardes de route uniquement, ce qui
 * supprime les allers-retours entre `useAuth` et `/auth` (chapitre 8, L1 et L5).
 * Les options sont conservées pour ne pas casser les appelants existants.
 */
export function useAuth(options: UseAuthOptions = {}) {
  const { redirectTo = "/auth", disableRedirect = false } = options;
  const { user, status, signOut } = useSession();
  const navigate = useNavigate();

  const logout = useCallback(async () => {
    await signOut();
    if (!disableRedirect) navigate(redirectTo);
  }, [signOut, navigate, redirectTo, disableRedirect]);

  return {
    user,
    loading: status === "loading",
    logout,
  };
}
