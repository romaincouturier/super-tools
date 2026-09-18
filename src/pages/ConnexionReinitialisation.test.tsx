import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ConnexionReinitialisation from "./ConnexionReinitialisation";

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  updatePassword: vi.fn(),
  markPasswordChanged: vi.fn(),
  confirmRecovery: vi.fn(),
  refresh: vi.fn(),
  stage: "ready" as "ready" | "confirm" | "invalid",
  calls: [] as string[],
}));

vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useNavigate: () => h.navigate,
}));

vi.mock("@/hooks/useAuthActions", () => ({
  useAuthActions: () => ({
    updatePassword: (...args: unknown[]) => {
      h.calls.push("updatePassword");
      return h.updatePassword(...args);
    },
    markPasswordChanged: (...args: unknown[]) => {
      h.calls.push("markPasswordChanged");
      return h.markPasswordChanged(...args);
    },
  }),
  usePasswordRecoverySession: () => ({ stage: h.stage, confirmRecovery: h.confirmRecovery }),
}));

vi.mock("@/hooks/useSession", () => ({
  useSession: () => ({ isStaff: false, mustChangePassword: false, refresh: h.refresh }),
}));

/**
 * ConnexionReinitialisation.tsx est accessible directement par URL, sans
 * passer par la résolution d'identité : un apprenant sans mot de passe peut
 * y arriver. S'il en définit un ici sans que password_set repasse à vrai
 * (mark_password_changed), la prochaine connexion le renverrait vers un
 * lien au lieu du mot de passe qu'il vient de créer (W8, point 6).
 */
function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/connexion/reinitialisation"]}>
        <ConnexionReinitialisation />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ConnexionReinitialisation", () => {
  beforeEach(() => {
    h.calls.length = 0;
    h.stage = "ready";
    h.updatePassword.mockReset().mockResolvedValue(null);
    h.markPasswordChanged.mockReset().mockResolvedValue(undefined);
    h.confirmRecovery.mockReset().mockResolvedValue(true);
    h.refresh.mockReset().mockResolvedValue(undefined);
    h.navigate.mockReset();
  });

  it("stage confirm : ni écran ni clic ajoutés, le même formulaire s'affiche directement", () => {
    h.stage = "confirm";
    renderPage();

    expect(screen.getByRole("heading", { name: "Nouveau mot de passe" })).toBeInTheDocument();
    expect(h.confirmRecovery).not.toHaveBeenCalled();
  });

  it("stage confirm : enregistrer le mot de passe consomme le jeton avant de l'enregistrer (RG-21)", async () => {
    h.stage = "confirm";
    renderPage();

    fireEvent.change(screen.getByLabelText("Nouveau mot de passe"), {
      target: { value: "Str0ng!Pass" },
    });
    fireEvent.change(screen.getByLabelText("Confirmer le mot de passe"), {
      target: { value: "Str0ng!Pass" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer mon nouveau mot de passe" }));

    await waitFor(() => expect(h.markPasswordChanged).toHaveBeenCalledTimes(1));
    expect(h.confirmRecovery).toHaveBeenCalledTimes(1);
    // L'ordre compte : rien n'est consommé avant ce clic, et le mot de passe
    // n'est enregistré qu'après confirmation du jeton.
    expect(h.calls).toEqual(["updatePassword", "markPasswordChanged"]);
    expect(h.confirmRecovery.mock.invocationCallOrder[0]).toBeLessThan(h.updatePassword.mock.invocationCallOrder[0]);
  });

  it("stage confirm : jeton déjà utilisé ou expiré, le mot de passe n'est jamais enregistré", async () => {
    h.stage = "confirm";
    h.confirmRecovery.mockResolvedValue(false);
    renderPage();

    fireEvent.change(screen.getByLabelText("Nouveau mot de passe"), {
      target: { value: "Str0ng!Pass" },
    });
    fireEvent.change(screen.getByLabelText("Confirmer le mot de passe"), {
      target: { value: "Str0ng!Pass" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer mon nouveau mot de passe" }));

    await waitFor(() => expect(h.confirmRecovery).toHaveBeenCalledTimes(1));
    expect(h.updatePassword).not.toHaveBeenCalled();
    expect(h.markPasswordChanged).not.toHaveBeenCalled();
  });

  it("stage ready (ancien format de lien, déjà consommé) : n'appelle jamais confirmRecovery", async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Nouveau mot de passe"), {
      target: { value: "Str0ng!Pass" },
    });
    fireEvent.change(screen.getByLabelText("Confirmer le mot de passe"), {
      target: { value: "Str0ng!Pass" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer mon nouveau mot de passe" }));

    await waitFor(() => expect(h.markPasswordChanged).toHaveBeenCalledTimes(1));
    expect(h.confirmRecovery).not.toHaveBeenCalled();
  });

  it("marque le mot de passe comme défini après l'avoir enregistré", async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Nouveau mot de passe"), {
      target: { value: "Str0ng!Pass" },
    });
    fireEvent.change(screen.getByLabelText("Confirmer le mot de passe"), {
      target: { value: "Str0ng!Pass" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer mon nouveau mot de passe" }));

    await waitFor(() => expect(h.markPasswordChanged).toHaveBeenCalledTimes(1));
    expect(h.updatePassword).toHaveBeenCalledWith("Str0ng!Pass");
    // L'ordre compte : le drapeau ne doit pas être posé si l'enregistrement échoue.
    expect(h.calls).toEqual(["updatePassword", "markPasswordChanged"]);
  });

  it("ne marque rien si l'enregistrement du mot de passe échoue", async () => {
    h.updatePassword.mockResolvedValue("Erreur serveur");

    renderPage();

    fireEvent.change(screen.getByLabelText("Nouveau mot de passe"), {
      target: { value: "Str0ng!Pass" },
    });
    fireEvent.change(screen.getByLabelText("Confirmer le mot de passe"), {
      target: { value: "Str0ng!Pass" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer mon nouveau mot de passe" }));

    await waitFor(() => expect(screen.getByText("Erreur serveur")).toBeInTheDocument());
    expect(h.markPasswordChanged).not.toHaveBeenCalled();
    expect(h.navigate).not.toHaveBeenCalled();
  });
});
