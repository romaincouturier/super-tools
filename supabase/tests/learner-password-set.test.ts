import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createTestDb, loadFunctions, createAuthUser, type TestDb } from "./helpers/db";

/**
 * learner_password_set : seule source de vérité pour sendLearnerAccessEmail
 * (Flux A sans lien magique) sur le choix entre lien "recovery" (création de
 * mot de passe) et lien préremplissant /connexion. Ne doit jamais révéler
 * l'existence d'un compte à un appelant qui ne le connaît pas déjà.
 */
let db: TestDb;

async function passwordSet(email: string) {
  const res = await db.query<{ learner_password_set: boolean | null }>(
    "SELECT public.learner_password_set($1)", [email],
  );
  return res.rows[0].learner_password_set;
}

beforeAll(async () => {
  db = await createTestDb();
  await loadFunctions(db, [
    { migration: "20260918141000_learner_password_set.sql", name: "learner_password_set" },
  ]);
});

beforeEach(async () => {
  await db.exec("TRUNCATE user_security_metadata; DELETE FROM auth.users;");
});

describe("learner_password_set", () => {
  it("renvoie null si l'adresse ne correspond à aucun compte", async () => {
    expect(await passwordSet("personne@exemple.fr")).toBeNull();
  });

  it("renvoie vrai par défaut pour un compte sans ligne user_security_metadata", async () => {
    await createAuthUser(db, "ancien@exemple.fr");
    expect(await passwordSet("ancien@exemple.fr")).toBe(true);
  });

  it("renvoie faux pour un compte provisionné sans mot de passe", async () => {
    await createAuthUser(db, "nouveau@exemple.fr", { passwordSet: false });
    expect(await passwordSet("nouveau@exemple.fr")).toBe(false);
  });

  it("renvoie vrai pour un compte qui a déjà défini un mot de passe", async () => {
    await createAuthUser(db, "equipee@exemple.fr", { passwordSet: true });
    expect(await passwordSet("equipee@exemple.fr")).toBe(true);
  });

  it("ignore la casse et les espaces de bord de l'adresse", async () => {
    await createAuthUser(db, "carla@exemple.fr", { passwordSet: false });
    expect(await passwordSet("  Carla@Exemple.FR  ")).toBe(false);
  });
});
