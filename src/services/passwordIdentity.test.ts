import { describe, it, expect, vi } from "vitest";
import { passwordIdentitySchema, loadPasswordIdentity, savePasswordIdentity } from "./passwordIdentity";

const h = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn(), upsert: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getUser: h.getUser }, from: h.from },
}));

describe("identité du mot de passe", () => {
  it.each(["firstName", "lastName"])("exige %s non vide", (field) => {
    expect(passwordIdentitySchema.safeParse({ firstName: "Alice", lastName: "Martin", [field]: "   " }).success).toBe(false);
  });

  it("ne lit aucun profil sans identité authentifiée", async () => {
    h.from.mockClear();
    h.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(loadPasswordIdentity()).rejects.toThrow("session a expiré");
    expect(h.from).not.toHaveBeenCalled();
  });

  it("sauvegarde les noms normalisés uniquement pour l’adresse authentifiée", async () => {
    h.getUser.mockResolvedValue({ data: { user: { email: "Alice@Example.com" } }, error: null });
    h.upsert.mockReturnValue({ select: () => ({ maybeSingle: async () => ({ data: { email: "alice@example.com" }, error: null }) }) });
    h.from.mockReturnValue({ upsert: h.upsert });
    await savePasswordIdentity({ firstName: " Alice ", lastName: " Martin " });
    expect(h.upsert).toHaveBeenCalledWith(expect.objectContaining({ email: "alice@example.com", first_name: "Alice", last_name: "Martin" }), { onConflict: "email" });
  });
});