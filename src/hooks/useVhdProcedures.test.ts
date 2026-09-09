// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

/**
 * Publication d'une version de procédure (indicateur 12).
 *
 * Un index unique interdit deux procédures actives. L'ordre des deux écritures
 * n'est donc pas un détail : archiver d'abord, activer ensuite. Dans l'autre
 * sens, l'activation échoue et l'ancienne version reste en vigueur sans que
 * rien ne le dise. Ce fichier épingle cet ordre.
 */

const { calls, mockFrom, mockToast } = vi.hoisted(() => {
  const calls: Array<{ table: string; status?: string; id?: string }> = [];
  const mockToast = vi.fn();
  const mockFrom = vi.fn((table: string) => ({
    select: () => ({
      order: () =>
        Promise.resolve({
          data: [
            { id: "v1", version: "1", content: "Ancienne", status: "active", created_at: "2026-01-01" },
            { id: "v2", version: "2", content: "Nouvelle", status: "draft", created_at: "2026-02-01" },
          ],
          error: null,
        }),
    }),
    update: (payload: { status?: string }) => ({
      eq: (_col: string, id: string) => {
        calls.push({ table, status: payload.status, id });
        return Promise.resolve({ error: null });
      },
    }),
  }));
  return { calls, mockFrom, mockToast };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mockFrom },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/lib/toastError", () => ({ toastError: vi.fn() }));

import { useVhdProcedures } from "./useVhdProcedures";

describe("useVhdProcedures", () => {
  beforeEach(() => {
    calls.length = 0;
    vi.clearAllMocks();
  });

  it("archive la version en vigueur avant d'activer la nouvelle", async () => {
    const { result } = renderHook(() => useVhdProcedures());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.publish("v2");
    });

    // Deux écritures, dans cet ordre : sinon l'index unique refuse la seconde.
    const writes = calls.filter((c) => c.table === "vhd_procedures");
    expect(writes).toEqual([
      { table: "vhd_procedures", status: "archived", id: "v1" },
      { table: "vhd_procedures", status: "active", id: "v2" },
    ]);
  });

  it("n'archive rien quand la version publiée est déjà celle en vigueur", async () => {
    const { result } = renderHook(() => useVhdProcedures());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.publish("v1");
    });

    // Archiver v1 pour l'activer ensuite la ferait disparaître des écrans.
    expect(calls.filter((c) => c.status === "archived")).toHaveLength(0);
    expect(calls.filter((c) => c.status === "active")).toHaveLength(1);
  });

  it("propose le numéro suivant le plus grand déjà utilisé", async () => {
    const { result } = renderHook(() => useVhdProcedures());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.suggestedVersion).toBe("3");
    expect(result.current.active?.id).toBe("v1");
  });
});
