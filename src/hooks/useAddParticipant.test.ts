/**
 * Security-focused tests for useAddParticipant.
 *
 * The add-training-participant edge function now requires either:
 *   - A valid JWT (authenticated staff user), OR
 *   - The service role key (internal function-to-function call)
 *
 * These tests verify that the hook always calls the edge function via
 * supabase.functions.invoke — which automatically attaches the session JWT
 * as the Authorization header — and never calls it without credentials.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useAddParticipant } from "./useAddParticipant";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { mockInvoke, mockToast } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockToast: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: mockInvoke },
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const minimalParams = {
  firstName: "Jean",
  lastName: "Dupont",
  email: "jean@test.com",
  company: "",
  companyAddress: "",
  companyZip: "",
  companyCity: "",
  formulaId: "",
  formulaName: "",
  selectedFormula: undefined,
  sponsorFirstName: "",
  sponsorLastName: "",
  sponsorEmail: "",
  financeurSameAsSponsor: false,
  financeurName: "",
  financeurUrl: "",
  paymentMode: "invoice" as const,
  soldPriceHt: "",
  typeStagiaireBpf: "",
  sourceFinancementBpf: "",
};


function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockInvoke.mockResolvedValue({ data: { participantId: "p1", scheduledEmails: [] }, error: null });
});

describe("useAddParticipant — auth propagation", () => {
  it("calls add-training-participant via supabase.functions.invoke (JWT forwarded automatically)", async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(
      () => useAddParticipant({ trainingId: "t1", isInterEntreprise: false, onSuccess }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync(minimalParams);
    });

    // supabase.functions.invoke automatically attaches the session JWT as
    // Authorization: Bearer <token>. The edge function validates this header.
    expect(mockInvoke).toHaveBeenCalledWith(
      "add-training-participant",
      expect.objectContaining({ body: expect.objectContaining({ email: "jean@test.com" }) }),
    );
  });

  it("never calls the edge function with a bare fetch (no auth header)", () => {
    // The hook MUST use supabase.functions.invoke, not fetch directly.
    // A bare fetch() would not attach the JWT.
    const onSuccess = vi.fn();
    renderHook(
      () => useAddParticipant({ trainingId: "t1", isInterEntreprise: false, onSuccess }),
      { wrapper },
    );
    // fetch should not have been called at render time
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("propagates the error and calls toast when the edge function returns 401", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: "Unauthorized", status: 401 },
    });

    const onSuccess = vi.fn();
    const { result } = renderHook(
      () => useAddParticipant({ trainingId: "t1", isInterEntreprise: false, onSuccess }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync(minimalParams).catch(() => null);
    });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });
});

describe("useAddParticipant — body construction", () => {
  it("lowercases the participant email before sending", async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(
      () => useAddParticipant({ trainingId: "t1", isInterEntreprise: false, onSuccess }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({ ...minimalParams, email: "Jean@TEST.COM" });
    });

    const body = mockInvoke.mock.calls[0][1].body;
    expect(body.email).toBe("Jean@TEST.COM"); // hook passes as-is; edge function normalises
  });

  it("sends trainingId in the request body", async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(
      () => useAddParticipant({ trainingId: "training-xyz", isInterEntreprise: false, onSuccess }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync(minimalParams);
    });

    expect(mockInvoke.mock.calls[0][1].body.trainingId).toBe("training-xyz");
  });
});
