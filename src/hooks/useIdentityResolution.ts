import { useCallback, useState } from "react";
import { useEdgeFunction } from "@/hooks/useEdgeFunction";

/** États d'aiguillage renvoyés par le service de résolution (chapitre 6.1). */
export type IdentityState = "password" | "unknown" | "throttled";

/** Repli si le service ne répond pas dans ce délai (chapitre 6.4). */
export const RESOLUTION_TIMEOUT_MS = 3000;

const KNOWN_STATES: IdentityState[] = ["password", "unknown", "throttled"];

/** Un état inconnu ou absent vaut panne : l'écran bascule en mode dégradé. */
export function parseIdentityState(payload: unknown): IdentityState | null {
  const state = (payload as { state?: string } | null)?.state;
  return KNOWN_STATES.includes(state as IdentityState) ? (state as IdentityState) : null;
}

export function useIdentityResolution() {
  const [resolving, setResolving] = useState(false);
  const { invoke } = useEdgeFunction("resolve-login-identity", { silentOnError: true });

  /** Renvoie l'état, ou null quand le service n'a pas répondu utilement. */
  const resolve = useCallback(
    async (email: string): Promise<IdentityState | null> => {
      setResolving(true);
      try {
        const timeout = new Promise<null>((resolve) =>
          window.setTimeout(() => resolve(null), RESOLUTION_TIMEOUT_MS),
        );
        const payload = await Promise.race([invoke({ email }), timeout]);
        return parseIdentityState(payload);
      } finally {
        setResolving(false);
      }
    },
    [invoke],
  );

  return { resolve, resolving };
}
