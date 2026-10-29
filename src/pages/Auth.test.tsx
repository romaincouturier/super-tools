import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Auth from "./Auth";
import Connexion from "./Connexion";

const h = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signIn: vi.fn(),
  resolve: vi.fn(),
  checkAttempt: vi.fn(),
  logAttempt: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: {
    signInWithPassword: h.signInWithPassword,
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  } },
}));
vi.mock("@/hooks/useAuthActions", () => ({ useAuthActions: () => ({ signIn: h.signIn }) }));
vi.mock("@/hooks/useIdentityResolution", () => ({ useIdentityResolution: () => ({ resolve: h.resolve, resolving: false }) }));
vi.mock("@/hooks/useSession", () => ({ useSession: () => ({ status: "signed_out", isStaff: false, mustChangePassword: false }) }));
vi.mock("@/hooks/useContactEmail", () => ({ useContactEmail: () => "support@example.com" }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock("@/hooks/useLoginAttempts", () => ({ useLoginAttempts: () => ({
  status: { isBlocked: false, delaySeconds: 0, remainingAttempts: 5 },
  countdown: 0, checkAttempt: h.checkAttempt, logAttempt: h.logAttempt,
  formatTimeRemaining: () => "",
}) }));
vi.mock("@/components/ForgotPasswordDialog", () => ({ default: () => null }));

function autofill(label: string, value: string) {
  const input = screen.getByLabelText(label) as HTMLInputElement;
  input.value = value;
  return input;
}

describe("login autofill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.checkAttempt.mockResolvedValue(true);
    h.logAttempt.mockResolvedValue(undefined);
    h.signInWithPassword.mockResolvedValue({ data: {}, error: new Error("Invalid login credentials") });
    h.signIn.mockResolvedValue({ ok: false });
    h.resolve.mockResolvedValue("known");
  });

  it("staff login sends autofilled credentials without change events", async () => {
    render(<MemoryRouter><Auth /></MemoryRouter>);
    const email = autofill("Email", "Autofill@Example.com");
    autofill("Mot de passe", " TestPassword123! ");
    if (!email.form) throw new Error("Missing login form");
    fireEvent.submit(email.form);
    await waitFor(() => expect(h.signInWithPassword).toHaveBeenCalledWith({
      email: "autofill@example.com", password: " TestPassword123! ",
    }));
    expect(h.checkAttempt).toHaveBeenCalledWith("autofill@example.com");
  });

  it("staff login never calls auth with empty credentials", () => {
    render(<MemoryRouter><Auth /></MemoryRouter>);
    const input = screen.getByLabelText("Email") as HTMLInputElement;
    if (!input.form) throw new Error("Missing login form");
    fireEvent.submit(input.form);
    expect(h.signInWithPassword).not.toHaveBeenCalled();
    expect(h.checkAttempt).not.toHaveBeenCalled();
  });

  it("learner login resolves and sends autofilled credentials without change events", async () => {
    render(<MemoryRouter><Connexion /></MemoryRouter>);
    const email = autofill("Adresse e-mail", "Learner@Example.com");
    if (!email.form) throw new Error("Missing email form");
    fireEvent.submit(email.form);
    await waitFor(() => expect(h.resolve).toHaveBeenCalledWith("learner@example.com"));
    const password = await screen.findByLabelText("Mot de passe") as HTMLInputElement;
    password.value = " TestPassword123! ";
    if (!password.form) throw new Error("Missing password form");
    fireEvent.submit(password.form);
    await waitFor(() => expect(h.signIn).toHaveBeenCalledWith("learner@example.com", " TestPassword123! "));
  });
});