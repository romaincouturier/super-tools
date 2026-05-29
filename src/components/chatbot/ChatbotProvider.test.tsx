import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";

vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-anon-key");

// Mock ChatbotWidget to isolate the guard logic
vi.mock("./ChatbotWidget", () => ({
  ChatbotWidget: () => React.createElement("div", { "data-testid": "chatbot-widget" }),
}));

const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn(() => ({
  data: { subscription: { unsubscribe: vi.fn() } },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: mockOnAuthStateChange,
    },
  },
}));

const staffSession = {
  session: { user: { user_metadata: { role: "staff" } } },
};
const learnerSession = {
  session: { user: { user_metadata: { role: "learner" } } },
};
const noSession = { session: null };

describe("ChatbotProvider — security guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  it("rend le widget pour un utilisateur staff", async () => {
    mockGetSession.mockResolvedValue({ data: staffSession });
    const { findByTestId } = render(
      React.createElement(
        (await import("./ChatbotProvider")).ChatbotProvider
      )
    );
    expect(await findByTestId("chatbot-widget")).toBeTruthy();
  });

  it("ne rend rien pour un apprenant (role=learner)", async () => {
    mockGetSession.mockResolvedValue({ data: learnerSession });
    const { queryByTestId } = render(
      React.createElement(
        (await import("./ChatbotProvider")).ChatbotProvider
      )
    );
    // Wait for async state update
    await new Promise((r) => setTimeout(r, 50));
    expect(queryByTestId("chatbot-widget")).toBeNull();
  });

  it("ne rend rien si non authentifié", async () => {
    mockGetSession.mockResolvedValue({ data: noSession });
    const { queryByTestId } = render(
      React.createElement(
        (await import("./ChatbotProvider")).ChatbotProvider
      )
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(queryByTestId("chatbot-widget")).toBeNull();
  });

  it("masque le widget quand la session passe de staff à learner", async () => {
    mockGetSession.mockResolvedValue({ data: staffSession });

    let authChangeCallback: (event: string, session: unknown) => void = vi.fn();
    mockOnAuthStateChange.mockImplementation((cb) => {
      authChangeCallback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    const { findByTestId, queryByTestId } = render(
      React.createElement(
        (await import("./ChatbotProvider")).ChatbotProvider
      )
    );

    expect(await findByTestId("chatbot-widget")).toBeTruthy();

    // Simulate session switch to learner account
    authChangeCallback("SIGNED_IN", { user: { user_metadata: { role: "learner" } } });
    await new Promise((r) => setTimeout(r, 50));
    expect(queryByTestId("chatbot-widget")).toBeNull();
  });
});
