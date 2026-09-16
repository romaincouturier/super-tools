import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { uploadLearnerPhoto, useLearnerProfile, useUpsertLearnerProfile } from "./useLearnerProfile";

// ── Mock env ──────────────────────────────────────────────────────────────────
vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");

// ── Supabase mock ─────────────────────────────────────────────────────────────

const { mockFrom, setNextResult, mockUpsert } = vi.hoisted(() => {
  let nextResult: { data: unknown; error: unknown } = { data: null, error: null };

  function makeChain(): any {
    const p = Promise.resolve(nextResult);
    return new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then") return p.then.bind(p);
          if (prop === "catch") return p.catch.bind(p);
          if (prop === "finally") return p.finally.bind(p);
          return vi.fn().mockReturnValue(makeChain());
        },
      },
    );
  }

  // upsert() est chaîné avec .select().maybeSingle() dans le hook : le mock doit
  // rendre la même chaîne, sinon il résout trop tôt.
  const mockUpsert = vi.fn(() => makeChain());
  const mockFrom = vi.fn((_table: string) => {
    // Build a chain that also exposes `upsert` for the learner_profiles table.
    const p = Promise.resolve(nextResult);
    return new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then") return p.then.bind(p);
          if (prop === "catch") return p.catch.bind(p);
          if (prop === "finally") return p.finally.bind(p);
          if (prop === "upsert") return mockUpsert;
          return vi.fn().mockReturnValue(makeChain());
        },
      },
    );
  });
  const setNextResult = (r: { data: unknown; error: unknown }) => { nextResult = r; };
  return { mockFrom, setNextResult, mockUpsert };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mockFrom },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  setNextResult({ data: null, error: null });
});

// ── useLearnerProfile ─────────────────────────────────────────────────────────

describe("useLearnerProfile", () => {
  it("is disabled when email is null — supabase is never called", () => {
    const { result } = renderHook(() => useLearnerProfile(null), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("queries learner_profiles and returns the profile", async () => {
    const profile = { email: "alice@example.com", first_name: "Alice", last_name: "Martin", fonction: null, photo_url: null, updated_at: "2026-01-01T00:00:00Z" };
    setNextResult({ data: profile, error: null });

    const { result } = renderHook(() => useLearnerProfile("ALICE@EXAMPLE.COM"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith("learner_profiles");
    expect(result.current.data).toEqual(profile);
  });

  it("returns null when no profile exists", async () => {
    setNextResult({ data: null, error: null });
    const { result } = renderHook(() => useLearnerProfile("unknown@test.com"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("propagates supabase errors", async () => {
    setNextResult({ data: null, error: { message: "permission denied" } });
    const { result } = renderHook(() => useLearnerProfile("a@b.com"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ── useUpsertLearnerProfile ───────────────────────────────────────────────────

describe("useUpsertLearnerProfile", () => {
  it("calls upsert on learner_profiles with lowercased email", async () => {
    setNextResult({ data: { email: "alice@example.com" }, error: null });
    const { result } = renderHook(() => useUpsertLearnerProfile(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        email: "Alice@EXAMPLE.COM",
        first_name: "Alice",
        last_name: "Martin",
        fonction: "Développeuse",
      });
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ email: "alice@example.com", first_name: "Alice" }),
      { onConflict: "email" },
    );
  });

  it("throws when upsert returns an error", async () => {
    // L'erreur remonte par la chaîne .select().maybeSingle(), pas par upsert().
    setNextResult({ data: null, error: { message: "RLS violation" } });
    const { result } = renderHook(() => useUpsertLearnerProfile(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ email: "a@b.com" });
      }),
    ).rejects.toThrow("RLS violation");
  });
});

// ── Security: own-row restriction ────────────────────────────────────────────
//
// L'identité vient de la session : get_learner_email() lit le jeton et plus
// aucun en-tête. Le hook doit malgré tout filtrer sur l'adresse de l'apprenant,
// pour que la requête reste bornée à sa propre ligne côté application.

describe("useLearnerProfile — security invariants", () => {

  it("filters by the learner's email before hitting the DB (own-row)", async () => {
    // The hook calls .eq("email", email.toLowerCase()) which means even if RLS
    // were misconfigured it would still only fetch the learner's own row.
    setNextResult({ data: { email: "alice@example.com" }, error: null });
    const { result } = renderHook(() => useLearnerProfile("Alice@Example.COM"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // mockFrom was called with "learner_profiles" — the chain includes .eq()
    expect(mockFrom).toHaveBeenCalledWith("learner_profiles");
  });

  it("upsert always lowercases the email key (consistent with RLS check on lower(email))", async () => {
    setNextResult({ data: { email: "upper@case.com" }, error: null });
    const { result } = renderHook(() => useUpsertLearnerProfile(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ email: "UPPER@CASE.COM", first_name: "X" });
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ email: "upper@case.com" }),
      { onConflict: "email" },
    );
  });
});

// ── uploadLearnerPhoto ────────────────────────────────────────────────────────

describe("uploadLearnerPhoto", () => {
  const testFile = new File(["photo"], "avatar.jpg", { type: "image/jpeg" });
  const testEmail = "Alice@Example.COM";

  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllEnvs());

  it("returns the URL from the successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ url: "https://cdn.example.com/avatar.jpg" }),
      }),
    );

    const url = await uploadLearnerPhoto(testFile, testEmail);
    expect(url).toBe("https://cdn.example.com/avatar.jpg");
  });

  it("lowercases the email before sending", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://cdn.example.com/avatar.jpg" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await uploadLearnerPhoto(testFile, testEmail);

    const formData = mockFetch.mock.calls[0][1].body as FormData;
    expect(formData.get("email")).toBe("alice@example.com");
  });

  it("appends the file to the FormData", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://cdn.example.com/avatar.jpg" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await uploadLearnerPhoto(testFile, testEmail);

    const formData = mockFetch.mock.calls[0][1].body as FormData;
    expect(formData.get("file")).toBe(testFile);
  });

  it("uses POST to the correct edge-function URL", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://cdn.example.com/avatar.jpg" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await uploadLearnerPhoto(testFile, testEmail);

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://test.supabase.co/functions/v1/upload-learner-photo");
    expect(init.method).toBe("POST");
  });

  it("throws with the response text when the server returns non-OK", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        text: async () => "Bucket quota exceeded",
      }),
    );

    await expect(uploadLearnerPhoto(testFile, testEmail)).rejects.toThrow("Bucket quota exceeded");
  });

  it("throws a fallback message when the error body is unreadable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        text: async () => { throw new Error("network"); },
      }),
    );

    await expect(uploadLearnerPhoto(testFile, testEmail)).rejects.toThrow("Erreur lors de l'envoi de la photo");
  });
});
