import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { useAuth } from "../useAuth";

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock supabase client
const mockUnsubscribe = vi.fn();
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockSignOut = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => mockMaybeSingle(),
        }),
      }),
    }),
  },
}));

const fakeUser = {
  id: "user-123",
  email: "test@example.com",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: "2024-01-01",
};

// Wrapper with router context
function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(MemoryRouter, null, children);
}

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    });

    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns loading=true initially", () => {
    mockGetSession.mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it("sets user when session exists", async () => {
    vi.useRealTimers();
    mockGetSession.mockResolvedValue({
      data: { session: { user: fakeUser } },
    });

    const { result } = renderHook(() => useAuth({ checkPasswordChange: false }), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual(fakeUser);
  });

  it("redirects to /auth when no session", async () => {
    vi.useRealTimers();
    mockGetSession.mockResolvedValue({
      data: { session: null },
    });

    renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/auth");
    });
  });

  it("redirects to custom path when redirectTo is set", async () => {
    vi.useRealTimers();
    mockGetSession.mockResolvedValue({
      data: { session: null },
    });

    renderHook(() => useAuth({ redirectTo: "/login" }), { wrapper });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("redirects to /force-password-change when password change is required", async () => {
    vi.useRealTimers();
    mockGetSession.mockResolvedValue({
      data: { session: { user: fakeUser } },
    });
    mockMaybeSingle.mockResolvedValue({
      data: { must_change_password: true },
      error: null,
    });

    renderHook(() => useAuth({ checkPasswordChange: true }), { wrapper });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/force-password-change");
    });
  });

  it("does not redirect to /force-password-change when check is disabled", async () => {
    vi.useRealTimers();
    mockGetSession.mockResolvedValue({
      data: { session: { user: fakeUser } },
    });

    const { result } = renderHook(() =>
      useAuth({ checkPasswordChange: false }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual(fakeUser);
    expect(mockNavigate).not.toHaveBeenCalledWith("/force-password-change");
  });

  it("handles getSession errors gracefully", async () => {
    vi.useRealTimers();
    mockGetSession.mockRejectedValue(new Error("Network error"));

    renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/auth");
    });
  });

  it("subscribes to auth state changes and cleans up", () => {
    mockGetSession.mockReturnValue(new Promise(() => {}));

    const { unmount } = renderHook(() => useAuth(), { wrapper });

    expect(mockOnAuthStateChange).toHaveBeenCalled();

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it("handles SIGNED_OUT event", async () => {
    vi.useRealTimers();
    let authCallback: (event: string, session: unknown) => void = () => {};

    mockGetSession.mockResolvedValue({
      data: { session: { user: fakeUser } },
    });
    mockOnAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
      authCallback = cb;
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
    });

    const { result } = renderHook(() => useAuth({ checkPasswordChange: false }), { wrapper });

    await waitFor(() => {
      expect(result.current.user).toEqual(fakeUser);
    });

    act(() => {
      authCallback("SIGNED_OUT", null);
    });

    expect(result.current.user).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith("/auth");
  });

  it("logout calls signOut and navigates", async () => {
    vi.useRealTimers();
    mockGetSession.mockResolvedValue({
      data: { session: { user: fakeUser } },
    });
    mockSignOut.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuth({ checkPasswordChange: false }), { wrapper });

    await waitFor(() => {
      expect(result.current.user).toEqual(fakeUser);
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(mockSignOut).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/auth");
  });

  it("times out after 8 seconds if loading never resolves", async () => {
    mockGetSession.mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.loading).toBe(true);

    // Advance past the 8s timeout
    act(() => {
      vi.advanceTimersByTime(8500);
    });

    expect(result.current.loading).toBe(false);
  });
});
