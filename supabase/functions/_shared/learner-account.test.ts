import { describe, it, expect, vi } from "vitest";
import { ensureLearnerAccount } from "./learner-account.ts";

type CreateUserResult = { data: { user: { id: string } | null } | null; error: { message: string } | null };

function makeAdmin(result: CreateUserResult) {
  const createUser = vi.fn().mockResolvedValue(result);
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn(() => ({ upsert }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = { auth: { admin: { createUser } }, from } as any;
  return { admin, createUser, upsert, from };
}

const ok = (id: string): CreateUserResult => ({ data: { user: { id } }, error: null });

describe("ensureLearnerAccount", () => {
  it("provisionne un compte sans mot de passe et marque password_set à faux", async () => {
    const { admin, createUser, from, upsert } = makeAdmin(ok("user-1"));

    await expect(ensureLearnerAccount(admin, "Jean.Dupont@Example.com")).resolves.toEqual({
      created: true,
      userId: "user-1",
    });

    expect(createUser).toHaveBeenCalledWith({
      email: "jean.dupont@example.com",
      email_confirm: true,
      user_metadata: { role: "learner" },
    });
    expect(from).toHaveBeenCalledWith("user_security_metadata");
    expect(upsert).toHaveBeenCalledWith(
      { user_id: "user-1", password_set: false },
      { onConflict: "user_id" },
    );
  });

  it("normalise l'adresse avant toute écriture (RG-01)", async () => {
    const { admin, createUser } = makeAdmin(ok("user-2"));

    await ensureLearnerAccount(admin, "  MARIE@EXAMPLE.COM  ");

    expect(createUser.mock.calls[0][0].email).toBe("marie@example.com");
  });

  it("ne touche jamais à un compte déjà présent (S1)", async () => {
    for (const message of [
      "User already registered",
      "A user with this email address has already been registered",
      "Email exists",
    ]) {
      const { admin, upsert } = makeAdmin({ data: null, error: { message } });

      await expect(ensureLearnerAccount(admin, "connu@example.com")).resolves.toEqual({
        created: false,
        userId: null,
      });
      expect(upsert).not.toHaveBeenCalled();
    }
  });

  it("remonte toute autre erreur au lieu de la faire passer pour un compte existant", async () => {
    const { admin } = makeAdmin({ data: null, error: { message: "Database connection lost" } });

    await expect(ensureLearnerAccount(admin, "panne@example.com")).rejects.toMatchObject({
      message: "Database connection lost",
    });
  });

  it("refuse une adresse inutilisable sans appeler le service d'authentification (RG-18)", async () => {
    for (const email of ["", "   ", "pas-une-adresse", "sans-domaine@", "@example.com", "a@"]) {
      const { admin, createUser } = makeAdmin(ok("jamais"));

      await expect(ensureLearnerAccount(admin, email)).resolves.toEqual({
        created: false,
        userId: null,
      });
      expect(createUser).not.toHaveBeenCalled();
    }
  });

  it("rend created à vrai même si l'identifiant n'est pas renvoyé, sans écrire de métadonnées", async () => {
    const { admin, upsert } = makeAdmin({ data: { user: null }, error: null });

    await expect(ensureLearnerAccount(admin, "sans-id@example.com")).resolves.toEqual({
      created: true,
      userId: null,
    });
    expect(upsert).not.toHaveBeenCalled();
  });
});
