import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const { mockRpc, mockSignUp, mockSignIn } = vi.hoisted(() => {
  const mockRpc = vi.fn();
  const mockSignUp = vi.fn();
  const mockSignIn = vi.fn();
  return { mockRpc, mockSignUp, mockSignIn };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mockRpc,
    auth: {
      signUp: mockSignUp,
      signInWithPassword: mockSignIn,
    },
  },
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useSearchParams: vi.fn(() => [new URLSearchParams("token=test-token")]),
  useNavigate: () => mockNavigate,
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/components/SupertiltLogo", () => ({
  default: () => <div data-testid="logo" />,
}));

import LearnerOnboarding from "./LearnerOnboarding";


// ── Helpers ───────────────────────────────────────────────────────────────────

const previewOk = (hasAccount: boolean, email = "alice@example.com") =>
  mockRpc.mockImplementation((fn: string) => {
    if (fn === "preview_learner_token")
      return Promise.resolve({ data: { status: "ok", email, has_account: hasAccount }, error: null });
    return Promise.resolve({ data: null, error: null });
  });

const previewStatus = (status: string, email = "alice@example.com") =>
  mockRpc.mockImplementation((fn: string) => {
    if (fn === "preview_learner_token")
      return Promise.resolve({ data: { status, email, has_account: true }, error: null });
    return Promise.resolve({ data: null, error: null });
  });

const typePassword = (value: string) =>
  fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value } });

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("LearnerOnboarding — token validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: null, error: null });
  });

  it("shows error when token is missing from URL", async () => {
    const { useSearchParams } = await import("react-router-dom");
    vi.mocked(useSearchParams).mockReturnValueOnce(
      [new URLSearchParams("")] as ReturnType<typeof useSearchParams>,
    );

    render(<LearnerOnboarding />);

    await waitFor(() =>
      expect(screen.getByText(/lien invalide/i)).toBeInTheDocument(),
    );
  });

  it("shows error when token is invalid", async () => {
    previewStatus("invalid");
    render(<LearnerOnboarding />);

    await waitFor(() =>
      expect(screen.getByText(/ce lien n'est pas valide/i)).toBeInTheDocument(),
    );
  });

  it("shows error when token is expired", async () => {
    previewStatus("expired");
    render(<LearnerOnboarding />);

    await waitFor(() =>
      expect(screen.getByText(/ce lien a expiré/i)).toBeInTheDocument(),
    );
  });

  it("shows create mode when token is valid and user has no account", async () => {
    previewOk(false);
    render(<LearnerOnboarding />);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /créer mon compte/i })).toBeInTheDocument(),
    );
  });

  it("shows login mode when token is valid and user already has an account", async () => {
    previewOk(true);
    render(<LearnerOnboarding />);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /se connecter/i })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("heading", { name: /créer mon compte/i })).not.toBeInTheDocument();
  });

  it("shows login mode with explanatory banner when token is already used", async () => {
    previewStatus("used");
    render(<LearnerOnboarding />);

    await waitFor(() =>
      expect(screen.getByText(/ce lien d'accès a déjà été utilisé/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole("heading", { name: /se connecter/i })).toBeInTheDocument();
  });

  it("pre-fills the email field from the token (read-only)", async () => {
    previewOk(false, "bob@example.com");
    render(<LearnerOnboarding />);

    await waitFor(() => {
      const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
      expect(emailInput.value).toBe("bob@example.com");
      expect(emailInput.readOnly).toBe(true);
    });
  });
});

describe("LearnerOnboarding — create account flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    previewOk(false);
    mockSignUp.mockResolvedValue({ error: null });
  });

  it("keeps submit button disabled until password field has a value", async () => {
    render(<LearnerOnboarding />);
    await waitFor(() => screen.getByLabelText("Mot de passe"));

    expect(screen.getByRole("button", { name: /créer mon compte/i })).toBeDisabled();
  });

  it("keeps submit button disabled for a weak password (score < 4)", async () => {
    render(<LearnerOnboarding />);
    await waitFor(() => screen.getByLabelText("Mot de passe"));

    act(() => typePassword("weak"));

    expect(screen.getByRole("button", { name: /créer mon compte/i })).toBeDisabled();
  });

  it("enables submit once password meets strength requirements", async () => {
    render(<LearnerOnboarding />);
    await waitFor(() => screen.getByLabelText("Mot de passe"));

    act(() => typePassword("Str0ng!Pass"));

    expect(screen.getByRole("button", { name: /créer mon compte/i })).not.toBeDisabled();
  });

  it("calls supabase.auth.signUp with role=learner on submit", async () => {
    render(<LearnerOnboarding />);
    await waitFor(() => screen.getByLabelText("Mot de passe"));

    act(() => typePassword("Str0ng!Pass"));
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /créer mon compte/i }).closest("form")!);
    });

    await waitFor(() =>
      expect(mockSignUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "alice@example.com",
          password: "Str0ng!Pass",
          options: expect.objectContaining({ data: { role: "learner" } }),
        }),
      ),
    );
  });

  it("consumes the token after successful signup", async () => {
    render(<LearnerOnboarding />);
    await waitFor(() => screen.getByLabelText("Mot de passe"));

    act(() => typePassword("Str0ng!Pass"));
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /créer mon compte/i }).closest("form")!);
    });

    await waitFor(() =>
      expect(mockRpc).toHaveBeenCalledWith("consume_learner_token", { p_token: "test-token" }),
    );
  });

  it("navigates to /espace-apprenant after successful signup", async () => {
    render(<LearnerOnboarding />);
    await waitFor(() => screen.getByLabelText("Mot de passe"));

    act(() => typePassword("Str0ng!Pass"));
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /créer mon compte/i }).closest("form")!);
    });

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/espace-apprenant"), {
      timeout: 2000,
    });
  });

  it("switches silently to login mode when signUp returns 'already registered'", async () => {
    mockSignUp.mockResolvedValueOnce({ error: { message: "User already registered" } });
    render(<LearnerOnboarding />);
    await waitFor(() => screen.getByLabelText("Mot de passe"));

    act(() => typePassword("Str0ng!Pass"));
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /créer mon compte/i }).closest("form")!);
    });

    // The form switches to login mode — that's the key assertion
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /se connecter/i })).toBeInTheDocument(),
    );
  });

  it("shows error message when signUp fails for another reason", async () => {
    mockSignUp.mockResolvedValueOnce({ error: { message: "Email rate limit exceeded" } });
    render(<LearnerOnboarding />);
    await waitFor(() => screen.getByLabelText("Mot de passe"));

    act(() => typePassword("Str0ng!Pass"));
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /créer mon compte/i }).closest("form")!);
    });

    await waitFor(() =>
      expect(screen.getByText(/email rate limit exceeded/i)).toBeInTheDocument(),
    );
  });
});

describe("LearnerOnboarding — login flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    previewOk(true);
    mockSignIn.mockResolvedValue({ error: null });
  });

  it("calls signInWithPassword on submit", async () => {
    render(<LearnerOnboarding />);
    await waitFor(() => screen.getByLabelText("Mot de passe"));

    act(() => typePassword("mypassword"));
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /me connecter/i }).closest("form")!);
    });

    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith({
        email: "alice@example.com",
        password: "mypassword",
      }),
    );
  });

  it("navigates to /espace-apprenant after successful login", async () => {
    render(<LearnerOnboarding />);
    await waitFor(() => screen.getByLabelText("Mot de passe"));

    act(() => typePassword("mypassword"));
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /me connecter/i }).closest("form")!);
    });

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/espace-apprenant"), {
      timeout: 2000,
    });
  });

  it("shows error message on wrong password", async () => {
    mockSignIn.mockResolvedValueOnce({ error: { message: "Invalid login credentials" } });
    render(<LearnerOnboarding />);
    await waitFor(() => screen.getByLabelText("Mot de passe"));

    act(() => typePassword("wrongpassword"));
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /me connecter/i }).closest("form")!);
    });

    await waitFor(() =>
      expect(screen.getByText(/mot de passe incorrect/i)).toBeInTheDocument(),
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows a reset password link", async () => {
    render(<LearnerOnboarding />);

    await waitFor(() =>
      expect(screen.getByText(/mot de passe oublié/i)).toBeInTheDocument(),
    );
  });
});

describe("LearnerOnboarding — mode switcher", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lets user switch from create to login mode manually", async () => {
    previewOk(false);
    render(<LearnerOnboarding />);

    await waitFor(() => screen.getByRole("heading", { name: /créer mon compte/i }));
    fireEvent.click(screen.getByRole("button", { name: /se connecter/i }));

    expect(screen.getByRole("heading", { name: /se connecter/i })).toBeInTheDocument();
  });

  it("lets user switch from login to create mode manually", async () => {
    previewOk(true);
    render(<LearnerOnboarding />);

    await waitFor(() => screen.getByRole("heading", { name: /se connecter/i }));
    fireEvent.click(screen.getByRole("button", { name: /créer un compte/i }));

    expect(screen.getByRole("heading", { name: /créer mon compte/i })).toBeInTheDocument();
  });

  it("clears the used-token banner when switching to create mode", async () => {
    previewStatus("used");
    render(<LearnerOnboarding />);

    await waitFor(() =>
      expect(screen.getByText(/ce lien d'accès a déjà été utilisé/i)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /créer un compte/i }));

    expect(screen.queryByText(/ce lien d'accès a déjà été utilisé/i)).not.toBeInTheDocument();
  });
});
