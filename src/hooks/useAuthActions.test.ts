import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePasswordRecoverySession } from "./useAuthActions";

const h = vi.hoisted(() => ({
  getSession: vi.fn(),
  verifyOtp: vi.fn(),
  authStateCallback: null as ((event: string) => void) | null,
  unsubscribe: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => h.getSession(...args),
      verifyOtp: (...args: unknown[]) => h.verifyOtp(...args),
      onAuthStateChange: (callback: (event: string) => void) => {
        h.authStateCallback = callback;
        return { data: { subscription: { unsubscribe: h.unsubscribe } } };
      },
    },
  },
}));

function setUrl(path: string) {
  window.history.pushState(null, "", path);
}

/**
 * RG-21 : le jeton ne doit être consommé qu'après un clic explicite, jamais
 * au chargement de la page (docs/SPEC_CONNEXION_APPRENANT.md, chapitre 19).
 * `usePasswordRecoverySession` distingue donc l'ancien format `#access_
 * token=...&type=recovery` (déjà consommé par Supabase avant l'arrivée sur
 * la page : "ready" directement) du nouveau `?token_hash=...&type=recovery`
 * (rien n'est consommé avant confirmRecovery : "confirm").
 */
describe("usePasswordRecoverySession", () => {
  beforeEach(() => {
    h.getSession.mockReset().mockResolvedValue({ data: { session: null } });
    h.verifyOtp.mockReset().mockResolvedValue({ error: null });
    h.authStateCallback = null;
    h.unsubscribe.mockReset();
    setUrl("/connexion/reinitialisation");
  });

  it("sans session ni paramètre : lien invalide", async () => {
    const { result } = renderHook(() => usePasswordRecoverySession());
    await waitFor(() => expect(result.current.stage).toBe("invalid"));
  });

  it("une session déjà active : prêt directement", async () => {
    h.getSession.mockResolvedValue({ data: { session: { access_token: "x" } } });
    const { result } = renderHook(() => usePasswordRecoverySession());
    await waitFor(() => expect(result.current.stage).toBe("ready"));
  });

  it("ancien format #access_token=...&type=recovery (déjà consommé) : prêt directement", async () => {
    setUrl("/connexion/reinitialisation#access_token=abc&type=recovery");
    const { result } = renderHook(() => usePasswordRecoverySession());
    await waitFor(() => expect(result.current.stage).toBe("ready"));
  });

  it("nouveau format ?token_hash=...&type=recovery : attend la confirmation, ne consomme rien", async () => {
    setUrl("/connexion/reinitialisation?token_hash=abc123&type=recovery");
    const { result } = renderHook(() => usePasswordRecoverySession());
    await waitFor(() => expect(result.current.stage).toBe("confirm"));
    expect(h.verifyOtp).not.toHaveBeenCalled();
  });

  it("un token_hash sans type=recovery n'est pas reconnu : lien invalide", async () => {
    setUrl("/connexion/reinitialisation?token_hash=abc123");
    const { result } = renderHook(() => usePasswordRecoverySession());
    await waitFor(() => expect(result.current.stage).toBe("invalid"));
  });

  it("confirmRecovery appelle verifyOtp avec le token_hash de l'URL", async () => {
    setUrl("/connexion/reinitialisation?token_hash=abc123&type=recovery");
    const { result } = renderHook(() => usePasswordRecoverySession());
    await waitFor(() => expect(result.current.stage).toBe("confirm"));

    await act(async () => {
      await result.current.confirmRecovery();
    });

    expect(h.verifyOtp).toHaveBeenCalledWith({ token_hash: "abc123", type: "recovery" });
  });

  it("confirmRecovery réussie : passe à prêt via l'événement PASSWORD_RECOVERY, comme le ferait Supabase", async () => {
    setUrl("/connexion/reinitialisation?token_hash=abc123&type=recovery");
    const { result } = renderHook(() => usePasswordRecoverySession());
    await waitFor(() => expect(result.current.stage).toBe("confirm"));

    await act(async () => {
      await result.current.confirmRecovery();
      // verifyOtp émet lui-même PASSWORD_RECOVERY en cas de succès (GoTrueClient) ;
      // on le simule pour vérifier que l'abonnement déjà en place le reçoit bien.
      h.authStateCallback?.("PASSWORD_RECOVERY");
    });

    expect(result.current.stage).toBe("ready");
  });

  it("confirmRecovery en échec (jeton déjà utilisé ou expiré) : lien invalide", async () => {
    h.verifyOtp.mockResolvedValue({ error: { message: "Token has expired or is invalid" } });
    setUrl("/connexion/reinitialisation?token_hash=abc123&type=recovery");
    const { result } = renderHook(() => usePasswordRecoverySession());
    await waitFor(() => expect(result.current.stage).toBe("confirm"));

    await act(async () => {
      await result.current.confirmRecovery();
    });

    expect(result.current.stage).toBe("invalid");
  });

  it("confirmRecovery sans token_hash dans l'URL : lien invalide, jamais d'appel à verifyOtp", async () => {
    const { result } = renderHook(() => usePasswordRecoverySession());
    await waitFor(() => expect(result.current.stage).toBe("invalid"));

    await act(async () => {
      await result.current.confirmRecovery();
    });

    expect(h.verifyOtp).not.toHaveBeenCalled();
    expect(result.current.stage).toBe("invalid");
  });
});
