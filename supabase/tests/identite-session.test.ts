import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createTestDb, loadFunctions, createAuthUser, actAs, type TestDb } from "./helpers/db";

/**
 * L'identité applicative vient de la session (PR7, RG-11) et le niveau d'accès
 * est tranché côté serveur (PR9, critère 13).
 */
let db: TestDb;

async function learnerEmail() {
  const res = await db.query<{ get_learner_email: string | null }>("SELECT public.get_learner_email()");
  return res.rows[0].get_learner_email;
}

async function accessLevel() {
  const res = await db.query<{ current_user_access_level: string }>(
    "SELECT public.current_user_access_level()",
  );
  return res.rows[0].current_user_access_level;
}

beforeAll(async () => {
  db = await createTestDb();
  await loadFunctions(db, [
    { migration: "20260915120000_lot6c_fermeture_entete_apprenant.sql", name: "get_learner_email" },
    { migration: "20260915130000_recette_niveau_acces_et_mentions.sql", name: "current_user_access_level" },
  ]);
});

beforeEach(async () => {
  await db.exec("TRUNCATE profiles, training_participants, lms_enrollments, learner_magic_links; DELETE FROM auth.users;");
  await actAs(db, null);
});

describe("get_learner_email", () => {
  it("rend l'adresse du jeton pour un participant connu", async () => {
    await db.query("INSERT INTO training_participants (email) VALUES ($1)", ["alice@exemple.fr"]);
    await actAs(db, { uid: "11111111-1111-1111-1111-111111111111", email: "alice@exemple.fr" });
    expect(await learnerEmail()).toBe("alice@exemple.fr");
  });

  it("ne rend rien sans session, même avec l'en-tête déclaré par le navigateur", async () => {
    await db.query("INSERT INTO training_participants (email) VALUES ($1)", ["alice@exemple.fr"]);
    // L'appelant pose l'en-tête, comme le faisait l'ancien client : il ne vaut
    // plus identité (faille S1 de docs/AUDIT_SURFACES_EXPOSEES.md).
    await actAs(db, { declaredEmail: "alice@exemple.fr" });
    expect(await learnerEmail()).toBeNull();
  });

  it("ne laisse pas un apprenant connecté se faire passer pour un autre par l'en-tête", async () => {
    await db.query("INSERT INTO training_participants (email) VALUES ($1), ($2)", [
      "alice@exemple.fr", "victime@exemple.fr",
    ]);
    await actAs(db, {
      uid: "44444444-4444-4444-4444-444444444444",
      email: "alice@exemple.fr",
      declaredEmail: "victime@exemple.fr",
    });
    expect(await learnerEmail()).toBe("alice@exemple.fr");
  });

  it("ne rend rien pour une adresse authentifiée mais inconnue des référentiels", async () => {
    await actAs(db, { uid: "11111111-1111-1111-1111-111111111111", email: "etranger@exemple.fr" });
    expect(await learnerEmail()).toBeNull();
  });

  it("reconnaît un inscrit Academy", async () => {
    await db.query("INSERT INTO lms_enrollments (learner_email) VALUES ($1)", ["bob@exemple.fr"]);
    await actAs(db, { uid: "22222222-2222-2222-2222-222222222222", email: "BOB@exemple.fr" });
    expect(await learnerEmail()).toBe("bob@exemple.fr");
  });

  it("ne reconnaît pas un lien jamais utilisé", async () => {
    await db.query("INSERT INTO learner_magic_links (email) VALUES ($1)", ["claire@exemple.fr"]);
    await actAs(db, { uid: "33333333-3333-3333-3333-333333333333", email: "claire@exemple.fr" });
    expect(await learnerEmail()).toBeNull();
  });
});

describe("current_user_access_level", () => {
  it("reconnaît l'équipe à sa ligne de profil", async () => {
    const id = await createAuthUser(db, "staff@supertilt.fr");
    await db.query("INSERT INTO profiles (user_id, email) VALUES ($1, $2)", [id, "staff@supertilt.fr"]);
    await actAs(db, { uid: id, email: "staff@supertilt.fr" });
    expect(await accessLevel()).toBe("staff");
  });

  it("reconnaît un apprenant à son rattachement", async () => {
    const id = await createAuthUser(db, "alice@exemple.fr");
    await db.query("INSERT INTO training_participants (email) VALUES ($1)", ["alice@exemple.fr"]);
    await actAs(db, { uid: id, email: "alice@exemple.fr" });
    expect(await accessLevel()).toBe("learner");
  });

  it("rend none pour un compte rattaché à rien (critère 13)", async () => {
    const id = await createAuthUser(db, "orphelin@exemple.fr");
    await actAs(db, { uid: id, email: "orphelin@exemple.fr" });
    expect(await accessLevel()).toBe("none");
  });

  it("rend anon sans session", async () => {
    await actAs(db, null);
    expect(await accessLevel()).toBe("anon");
  });

  it("ne laisse pas un lien non consommé faire un apprenant", async () => {
    const id = await createAuthUser(db, "curieux@exemple.fr");
    await db.query("INSERT INTO learner_magic_links (email) VALUES ($1)", ["curieux@exemple.fr"]);
    await actAs(db, { uid: id, email: "curieux@exemple.fr" });
    expect(await accessLevel()).toBe("none");
  });

  it("fait de l'équipe du staff même si elle est aussi inscrite à une formation", async () => {
    const id = await createAuthUser(db, "formateur@supertilt.fr");
    await db.query("INSERT INTO profiles (user_id, email) VALUES ($1, $2)", [id, "formateur@supertilt.fr"]);
    await db.query("INSERT INTO training_participants (email) VALUES ($1)", ["formateur@supertilt.fr"]);
    await actAs(db, { uid: id, email: "formateur@supertilt.fr" });
    expect(await accessLevel()).toBe("staff");
  });
});
