import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import AcademySignup from "./AcademySignup";
import { AcademyAccountExistsError } from "@/services/academyAccount";

const h = vi.hoisted(() => ({ create: vi.fn(), signIn: vi.fn(), enroll: vi.fn(), refresh: vi.fn(), existing: vi.fn(), toast: vi.fn() }));
vi.mock("@/hooks/useAcademyAccount", () => ({ useAcademyAccount: () => ({ mutateAsync: h.create, isPending: false }) }));
vi.mock("@/hooks/useAcademyAuth", () => ({ useAcademyAuth: () => ({ loading: false, user: null, signIn: h.signIn }) }));
vi.mock("@/hooks/useAcademyCatalog", () => ({ useAcademyCatalog: () => ({ data: { courses: [] }, isLoading: false }) }));
vi.mock("@/hooks/useAcademyEnrollment", () => ({ useAcademyEnrollment: () => ({ mutateAsync: h.enroll }) }));
vi.mock("@/hooks/useSession", () => ({ useSession: () => ({ refresh: h.refresh }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock("@/services/academyAccount", async (load) => ({ ...await load<typeof import("@/services/academyAccount")>(), hasExistingAcademyEnrollment: h.existing }));

function Destination() { const location = useLocation(); return <div data-testid="destination">{location.pathname}{location.search}</div>; }
function start() {
  render(<MemoryRouter initialEntries={["/academy/inscription"]}><Routes><Route path="/academy/inscription" element={<AcademySignup />} /><Route path="*" element={<Destination />} /></Routes></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("Prénom"), { target: { value: "Marie" } });
  fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Leurent" } });
  fireEvent.change(screen.getByLabelText("Adresse email"), { target: { value: "marie.leurent@orange.fr" } });
  fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: "TestPassword123!" } });
  fireEvent.click(screen.getByRole("button", { name: "Créer mon compte" }));
}

describe("Orientation Academy après inscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.create.mockResolvedValue({ success: true });
    h.signIn.mockResolvedValue(undefined);
    h.refresh.mockResolvedValue(undefined);
    h.existing.mockResolvedValue(true);
  });

  it("une inscription existante ouvre l'espace sans ajout d'une formation gratuite", async () => {
    start();
    expect(await screen.findByTestId("destination")).toHaveTextContent("/espace-apprenant");
    expect(h.refresh).toHaveBeenCalledOnce();
    expect(h.enroll).not.toHaveBeenCalled();
  });

  it("un nouveau compte sans inscription garde le choix des formations", async () => {
    h.existing.mockResolvedValue(false);
    start();
    expect(await screen.findByTestId("destination")).toHaveTextContent("/academy/choisir-mes-formations");
  });

  it("un doublon ne tente pas de connexion ni d'envoi et permet la récupération avec l'adresse", async () => {
    h.create.mockRejectedValue(new AcademyAccountExistsError());
    start();
    const link = await screen.findByRole("link", { name: "Mot de passe oublié / créer mon mot de passe" });
    fireEvent.click(link);
    expect(await screen.findByTestId("destination")).toHaveTextContent("/connexion/mot-de-passe-oublie?email=marie.leurent%40orange.fr");
    expect(h.signIn).not.toHaveBeenCalled();
    expect(h.enroll).not.toHaveBeenCalled();
  });

  it("verrouille la soumission pendant la connexion, après la création", async () => {
    h.signIn.mockReturnValue(new Promise(() => {}));
    start();
    await waitFor(() => expect(h.signIn).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "" })).toBeDisabled();
    expect(h.create).toHaveBeenCalledOnce();
  });
});