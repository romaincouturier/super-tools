import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRpc, mockFrom, setProfile } = vi.hoisted(() => {
  let profile: unknown = null;
  const mockRpc = vi.fn();
  const mockFrom = vi.fn(() => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile, error: null }) }) }),
  }));
  return { mockRpc, mockFrom, setProfile: (p: unknown) => { profile = p; } };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: mockRpc, from: mockFrom },
}));

const { fetchAccessLevel } = await import("./accessLevel");

describe("fetchAccessLevel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setProfile(null);
  });

  it("rend le niveau calculé par le serveur", async () => {
    mockRpc.mockResolvedValue({ data: "learner", error: null });
    expect(await fetchAccessLevel("u1")).toBe("learner");
  });

  it("reconnaît un compte sans rattachement", async () => {
    mockRpc.mockResolvedValue({ data: "none", error: null });
    expect(await fetchAccessLevel("u1")).toBe("none");
  });

  it("retombe sur le profil quand la fonction serveur n'est pas déployée", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "function does not exist" } });
    setProfile({ user_id: "u1" });
    expect(await fetchAccessLevel("u1")).toBe("staff");
  });

  it("ne bloque jamais un apprenant quand la fonction serveur manque", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "function does not exist" } });
    setProfile(null);
    expect(await fetchAccessLevel("u1")).toBe("learner");
  });
});
