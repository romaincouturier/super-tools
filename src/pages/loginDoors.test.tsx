import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Auth from "./Auth";
import Connexion from "./Connexion";
import { RequireStaff } from "@/components/RequireStaff";

const h = vi.hoisted(() => ({
  session: vi.fn(),
  refresh: vi.fn(),
  signInWithPassword: vi.fn(),
  signIn: vi.fn(),
  resolve: vi.fn(),
  checkAttempt: vi.fn(),
  logAttempt: vi.fn(),
  toast: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword: h.signInWithPassword,
      getSession: h.getSession,
      onAuthStateChange: h.onAuthStateChange,
      getUser: h.getUser,
      signOut: vi.fn(),
    },
    from: h.from,
    rpc: h.rpc,
  },
}));
vi.mock("@/hooks/useAuthActions", () => ({ useAuthActions: () => ({ signIn: h.signIn }) }));
vi.mock("@/hooks/useIdentityResolution", () => ({
  useIdentityResolution: () => ({ resolve: h.resolve, resolving: false }),
}));
vi.mock("@/hooks/useSession", () => ({ useSession: () => ({ ...h.session(), refresh: h.refresh }) }));
vi.mock("@/hooks/useContactEmail", () => ({ useContactEmail: () => "support@example.com" }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock("@/hooks/useLoginAttempts", () => ({
  useLoginAttempts: () => ({
    status: { isBlocked: false, delaySeconds: 0, remainingAttempts: 5 },
    countdown: 0,
    checkAttempt: h.checkAttempt,
    logAttempt: h.logAttempt,
    formatTimeRemaining: () => "",
  }),
}));
vi.mock("@/components/ForgotPasswordDialog", () => ({ default: () => null }));
vi.mock("@/components/auth/MaintenanceBanner", () => ({ default: () => null }));

const CONNECTED_STAFF = {
  status: "staff", isStaff: true, mustChangePassword: false, passwordSet: true,
};
const CONNECTED_LEARNER_WITHOUT_PASSWORD = {
  status: "learner", isStaff: false, mustChangePassword: false, passwordSet: false,
};

function renderAt(path: string, element: ReactElement) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/connexion" element={element} />
        <Route path="/auth" element={element} />
        <Route path="/dashboard" element={<div>BACK OFFICE</div>} />
        <Route path="/espace-apprenant" element={<div>ESPACE APPRENANT</div>} />
        <Route path="/espace-apprenant/tableau-de-bord" element={<div>ESPACE APPRENANT</div>} />
        <Route path="/compte-sans-acces" element={<div>SANS ACCES</div>} />
        <Route path="/force-password-change" element={<div>CHANGEMENT MOT DE PASSE</div>} />
        <Route path="/connexion/definir-mot-de-passe" element={<div>CREATION MOT DE PASSE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderBackOffice(status: string) {
  h.session.mockReturnValue({
    status, isStaff: false, mustChangePassword: false, passwordSet: true,
  });
  return render(
    <MemoryRouter initialEntries={["/back-office"]}>
      <Routes>
        <Route element={<RequireStaff />}>
          <Route path="/back-office" element={<div>BACK OFFICE</div>} />
        </Route>
        <Route path="/auth" element={<div>PORTE BACK OFFICE</div>} />
        <Route path="/espace-apprenant" element={<div>ESPACE APPRENANT</div>} />
        <Route path="/compte-sans-acces" element={<div>SANS ACCES</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("portes de connexion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.session.mockReturnValue({ status: "anon", isStaff: false, mustChangePassword: false, passwordSet: true });
    h.getSession.mockResolvedValue({ data: { session: null } });
    h.getUser.mockResolvedValue({ data: { user: null } });
    h.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    h.from.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
    });
    h.resolve.mockResolvedValue("password");
    h.checkAttempt.mockResolvedValue(true);
    h.logAttempt.mockResolvedValue(undefined);
    h.refresh.mockResolvedValue(undefined);
  });

  it("la porte apprenant ouvre l'espace apprenant quand une session staff est déjà ouverte", () => {
    h.session.mockReturnValue(CONNECTED_STAFF);
    renderAt("/connexion", <Connexion />);
    expect(screen.getByText("ESPACE APPRENANT")).toBeInTheDocument();
    expect(screen.queryByText("BACK OFFICE")).toBeNull();
    expect(screen.queryByText("CREATION MOT DE PASSE")).toBeNull();
  });

  it("la porte apprenant rejoint l'espace protégé avec une session apprenante existante", () => {
    h.session.mockReturnValue(CONNECTED_LEARNER_WITHOUT_PASSWORD);
    renderAt("/connexion", <Connexion />);
    expect(screen.getByText("ESPACE APPRENANT")).toBeInTheDocument();
    expect(screen.queryByText("CREATION MOT DE PASSE")).toBeNull();
  });

  it("la porte apprenant affiche le formulaire sans session", () => {
    renderAt("/connexion", <Connexion />);
    expect(screen.getByLabelText("Adresse e-mail")).toBeInTheDocument();
    expect(screen.queryByText("ESPACE APPRENANT")).toBeNull();
  });

  it("la porte apprenant ne renvoie pas une session existante dans le back-office via next", () => {
    h.session.mockReturnValue(CONNECTED_STAFF);
    renderAt("/connexion?next=%2Fdashboard", <Connexion />);
    expect(screen.getByText("ESPACE APPRENANT")).toBeInTheDocument();
    expect(screen.queryByText("BACK OFFICE")).toBeNull();
  });

  it("la porte du back-office garde son formulaire quand une session est déjà ouverte", async () => {
    h.session.mockReturnValue(CONNECTED_STAFF);
    const user = { id: "u1", user_metadata: { role: "learner" } };
    h.getSession.mockResolvedValue({ data: { session: { user } } });
    h.getUser.mockResolvedValue({ data: { user } });
    renderAt("/auth", <Auth />);
    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
    expect(screen.queryByText("BACK OFFICE")).toBeNull();
    expect(screen.queryByText("ESPACE APPRENANT")).toBeNull();
  });

  it("le back-office reste fermé à un apprenant", async () => {
    renderBackOffice("learner");
    expect(await screen.findByText("ESPACE APPRENANT")).toBeInTheDocument();
    expect(screen.queryByText("BACK OFFICE")).toBeNull();
  });

  it("une connexion administrateur réussie quitte le formulaire après actualisation de la session", async () => {
    h.signInWithPassword.mockResolvedValue({ data: { user: { id: "admin" } }, error: null });
    h.from.mockImplementation((table: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({
        data: table === "profiles" ? { user_id: "admin" } : { must_change_password: false },
      }) }) }),
    }));
    h.rpc.mockResolvedValue({ data: null, error: null });
    renderAt("/auth", <Auth />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@example.com" } });
    fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: "StrongPassword123!" } });
    fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(await screen.findByText("BACK OFFICE")).toBeInTheDocument();
    expect(h.refresh).toHaveBeenCalledOnce();
    expect(screen.queryByLabelText("Email")).toBeNull();
  });

  it("le back-office reste fermé à une personne non connectée", async () => {
    renderBackOffice("anon");
    expect(await screen.findByText("PORTE BACK OFFICE")).toBeInTheDocument();
    expect(screen.queryByText("BACK OFFICE")).toBeNull();
  });
});
