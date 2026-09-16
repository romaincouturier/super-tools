import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  configs: [] as Record<string, unknown>[],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: h.rpc },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (config: Record<string, unknown>) => {
    h.configs.push(config);
    return { data: undefined, isLoading: false };
  },
}));

import { useConnexionIndicators, useDormantLearnerAccounts } from "./useConnexionIndicators";

type QueryConfig = {
  queryKey: unknown[];
  queryFn: () => Promise<unknown>;
  staleTime: number;
};

const lastConfig = () => h.configs[h.configs.length - 1] as unknown as QueryConfig;

beforeEach(() => {
  h.configs.length = 0;
  h.rpc.mockReset();
});

describe("useConnexionIndicators", () => {
  it("interroge connexion_indicators sur la fenêtre demandée", async () => {
    h.rpc.mockResolvedValue({ data: { window_days: 7, successful_logins: 3 }, error: null });
    useConnexionIndicators(7);

    const config = lastConfig();
    expect(config.queryKey).toEqual(["connexion-indicators", 7]);
    await expect(config.queryFn()).resolves.toEqual({ window_days: 7, successful_logins: 3 });
    expect(h.rpc).toHaveBeenCalledWith("connexion_indicators", { p_days: 7 });
  });

  it("retient 30 jours par défaut", () => {
    useConnexionIndicators();
    expect(lastConfig().queryKey).toEqual(["connexion-indicators", 30]);
  });

  it("remonte l'erreur au lieu de rendre des indicateurs vides", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: "permission denied" } });
    useConnexionIndicators();

    await expect(lastConfig().queryFn()).rejects.toMatchObject({ message: "permission denied" });
  });
});

describe("useDormantLearnerAccounts", () => {
  it("interroge list_dormant_learner_accounts sur l'ancienneté demandée", async () => {
    h.rpc.mockResolvedValue({ data: [{ email: "vieux@example.com" }], error: null });
    useDormantLearnerAccounts(5);

    const config = lastConfig();
    expect(config.queryKey).toEqual(["dormant-learner-accounts", 5]);
    await expect(config.queryFn()).resolves.toEqual([{ email: "vieux@example.com" }]);
    expect(h.rpc).toHaveBeenCalledWith("list_dormant_learner_accounts", { p_years: 5 });
  });

  it("retient 3 ans par défaut (RG-23)", () => {
    useDormantLearnerAccounts();
    expect(lastConfig().queryKey).toEqual(["dormant-learner-accounts", 3]);
  });

  it("rend une liste vide plutôt que null quand aucun compte ne dort", async () => {
    h.rpc.mockResolvedValue({ data: null, error: null });
    useDormantLearnerAccounts();

    await expect(lastConfig().queryFn()).resolves.toEqual([]);
  });

  it("remonte l'erreur au lieu de rendre une liste vide trompeuse", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: "function does not exist" } });
    useDormantLearnerAccounts();

    await expect(lastConfig().queryFn()).rejects.toMatchObject({ message: "function does not exist" });
  });
});
