import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createTestDb, loadFunctions, createAuthUser, actAs, type TestDb } from "./helpers/db";

/**
 * Critère 11 et faille S4 : les données du portail ne s'obtiennent qu'avec une
 * session, et seulement pour sa propre adresse. Le staff garde la
 * prévisualisation.
 */
let db: TestDb;
const STAFF = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

async function portal(email: string) {
  const res = await db.query<{ get_learner_portal_data: { email: string } }>(
    "SELECT public.get_learner_portal_data($1)", [email],
  );
  return res.rows[0].get_learner_portal_data;
}

beforeAll(async () => {
  db = await createTestDb();
  await loadFunctions(db, [
    { migration: "20260914150000_lot1_identite_apprenant.sql", name: "get_learner_portal_data" },
  ]);
});

beforeEach(async () => {
  await db.exec("TRUNCATE profiles, training_participants; DELETE FROM auth.users;");
  await db.query("INSERT INTO profiles (user_id, email) VALUES ($1, $2)", [STAFF, "staff@supertilt.fr"]);
});

describe("get_learner_portal_data", () => {
  it("refuse un appelant sans session", async () => {
    await actAs(db, null);
    await expect(portal("alice@exemple.fr")).rejects.toThrow(/Authentification requise/);
  });

  it("refuse un apprenant qui demande l'adresse d'un autre", async () => {
    const id = await createAuthUser(db, "alice@exemple.fr");
    await actAs(db, { uid: id, email: "alice@exemple.fr" });
    await expect(portal("bob@exemple.fr")).rejects.toThrow(/Accès refusé/);
  });

  it("laisse un apprenant lire sa propre adresse", async () => {
    const id = await createAuthUser(db, "alice@exemple.fr");
    await actAs(db, { uid: id, email: "alice@exemple.fr" });
    const data = await portal("alice@exemple.fr");
    expect(data.email).toBe("alice@exemple.fr");
  });

  it("ignore la casse entre le jeton et l'adresse demandée", async () => {
    const id = await createAuthUser(db, "alice@exemple.fr");
    await actAs(db, { uid: id, email: "alice@exemple.fr" });
    const data = await portal("Alice@Exemple.FR");
    expect(data.email).toBe("Alice@Exemple.FR");
  });

  it("laisse l'équipe prévisualiser l'espace d'un apprenant", async () => {
    await actAs(db, { uid: STAFF, email: "staff@supertilt.fr" });
    const data = await portal("alice@exemple.fr");
    expect(data.email).toBe("alice@exemple.fr");
  });
});
