import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { tables, demo } = vi.hoisted(() => ({
  tables: {} as Record<string, { rows: Record<string, string | null>[]; error?: { message: string } }>,
  demo: { on: true },
}));

vi.mock("@/contexts/DemoModeContext", () => ({ useDemoMode: () => ({ isDemoMode: demo.on }) }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        order: () => ({
          range: (from: number, to: number) => {
            const t = tables[table] ?? { rows: [] };
            if (t.error) return Promise.resolve({ data: null, error: t.error });
            return Promise.resolve({ data: t.rows.slice(from, to + 1), error: null });
          },
        }),
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: tables.app_settings?.rows[0] ?? null, error: null }),
        }),
      }),
    }),
  },
}));

import { useDemoClientNames } from "./useDemoClientNames";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

describe("useDemoClientNames", () => {
  beforeEach(() => {
    for (const k of Object.keys(tables)) delete tables[k];
    demo.on = true;
  });

  it("masque les clients connus et les noms ajoutés à la main, pas SuperTilt", async () => {
    tables.crm_cards = { rows: [{ company: "Henry Schein", first_name: "Jean", last_name: "Bisous" }, { company: "SuperTilt", first_name: null, last_name: null }] };
    tables.app_settings = { rows: [{ setting_value: "Goood!\nAcqera" }] };

    const { result } = renderHook(() => useDemoClientNames(), { wrapper });
    expect(result.current.pending).toBe(true);
    await waitFor(() => expect(result.current.pending).toBe(false));

    expect(result.current.mask("Scribing Henry Schein pour Goood! avec SuperTilt")).toBe(
      "Scribing H•••y S••••n pour G••••! avec SuperTilt",
    );
    expect(result.current.mask("Post Jean Bisous")).toBe("Post J••n B••••s");
  });

  it("lit au-delà de 1000 lignes", async () => {
    tables.training_participants = {
      rows: [...Array.from({ length: 1000 }, (_, i) => ({ company: `Societe${i}` })), { company: "Dernière Entreprise" }],
    };

    const { result } = renderHook(() => useDemoClientNames(), { wrapper });
    await waitFor(() => expect(result.current.pending).toBe(false));

    expect(result.current.mask("Atelier Dernière Entreprise")).toBe("Atelier D••••••e E••••••••e");
  });

  it("reste en attente (texte à flouter) si une table échoue", async () => {
    tables.quotes = { rows: [], error: { message: "permission denied" } };

    const { result } = renderHook(() => useDemoClientNames(), { wrapper });
    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.pending).toBe(true);
  });

  it("hors mode démo, ne charge rien et rend le texte tel quel", () => {
    demo.on = false;
    tables.crm_cards = { rows: [{ company: "Henry Schein", first_name: null, last_name: null }] };

    const { result } = renderHook(() => useDemoClientNames(), { wrapper });

    expect(result.current.pending).toBe(false);
    expect(result.current.mask("Scribing Henry Schein")).toBe("Scribing Henry Schein");
  });
});
