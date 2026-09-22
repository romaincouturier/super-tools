import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createTestDb, loadFunctions, actAs, type TestDb } from "./helpers/db";

/**
 * is_known_learner : point d'entrée unique pour « cette adresse est-elle une
 * apprenante connue ? », extrait de get_learner_email() et
 * current_user_access_level() (20260922100000_is_known_learner.sql) pour ne
 * plus dupliquer les deux mêmes EXISTS à trois endroits.
 *
 * Ce fichier couvre aussi la variante RÉELLEMENT DÉPLOYÉE de
 * get_learner_email() (celle de la démolition du lien magique) : jusqu'ici,
 * seule la variante différée (fermeture de l'en-tête x-learner-email, pas
 * encore promue) était chargée dans identite-session.test.ts — la variante
 * active n'avait aucune couverture au niveau unitaire, seulement pgTAP en CI.
 */
let db: TestDb;

async function isKnownLearner(email: string) {
  const res = await db.query<{ is_known_learner: boolean }>(
    "SELECT public.is_known_learner($1)",
    [email],
  );
  return res.rows[0].is_known_learner;
}

async function learnerEmail() {
  const res = await db.query<{ get_learner_email: string | null }>("SELECT public.get_learner_email()");
  return res.rows[0].get_learner_email;
}

beforeAll(async () => {
  db = await createTestDb();
  await loadFunctions(db, [
    { migration: "20260922100000_is_known_learner.sql", name: "is_known_learner" },
    // La variante active, celle réellement déployée — distincte de la
    // variante différée testée dans identite-session.test.ts.
    { migration: "20260918160000_demolition_lien_magique.sql", name: "get_learner_email" },
  ]);
});

beforeEach(async () => {
  await db.exec("TRUNCATE training_participants, lms_enrollments; DELETE FROM auth.users;");
  await actAs(db, null);
});

describe("is_known_learner", () => {
  it("reconnaît un participant à une formation", async () => {
    await db.query("INSERT INTO training_participants (email) VALUES ($1)", ["alice@exemple.fr"]);
    expect(await isKnownLearner("alice@exemple.fr")).toBe(true);
  });

  it("reconnaît un inscrit Academy", async () => {
    await db.query("INSERT INTO lms_enrollments (learner_email) VALUES ($1)", ["bob@exemple.fr"]);
    expect(await isKnownLearner("bob@exemple.fr")).toBe(true);
  });

  it("reconnaît une adresse présente dans les deux référentiels", async () => {
    await db.query("INSERT INTO training_participants (email) VALUES ($1)", ["alice@exemple.fr"]);
    await db.query("INSERT INTO lms_enrollments (learner_email) VALUES ($1)", ["alice@exemple.fr"]);
    expect(await isKnownLearner("alice@exemple.fr")).toBe(true);
  });

  it("ne reconnaît pas une adresse absente des deux référentiels", async () => {
    expect(await isKnownLearner("etranger@exemple.fr")).toBe(false);
  });

  it("normalise casse et espaces de bord", async () => {
    await db.query("INSERT INTO training_participants (email) VALUES ($1)", ["alice@exemple.fr"]);
    expect(await isKnownLearner("  ALICE@Exemple.fr  ")).toBe(true);
  });

  it("reste vrai pour une adresse partagée par plusieurs personnes (chapitre 16)", async () => {
    // Un commanditaire inscrit deux collaborateurs sous sa propre adresse :
    // deux lignes training_participants, la même adresse. is_known_learner
    // est un booléen, indifférent au nombre de lignes qui matchent.
    await db.query("INSERT INTO training_participants (email, first_name) VALUES ($1, $2), ($1, $3)", [
      "commanditaire@exemple.fr", "Collaborateur 1", "Collaborateur 2",
    ]);
    expect(await isKnownLearner("commanditaire@exemple.fr")).toBe(true);
  });
});

describe("get_learner_email (variante active, démolition du lien magique)", () => {
  it("ne rend rien pour un compte authentifié sans rattachement", async () => {
    await actAs(db, { uid: "11111111-1111-1111-1111-111111111111", email: "orphelin@exemple.fr" });
    expect(await learnerEmail()).toBeNull();
  });

  it("rend l'adresse pour un compte authentifié rattaché à une formation", async () => {
    await db.query("INSERT INTO training_participants (email) VALUES ($1)", ["alice@exemple.fr"]);
    await actAs(db, { uid: "11111111-1111-1111-1111-111111111111", email: "alice@exemple.fr" });
    expect(await learnerEmail()).toBe("alice@exemple.fr");
  });

  it("rend l'adresse pour un compte authentifié inscrit à une formation Academy", async () => {
    await db.query("INSERT INTO lms_enrollments (learner_email) VALUES ($1)", ["bob@exemple.fr"]);
    await actAs(db, { uid: "22222222-2222-2222-2222-222222222222", email: "BOB@exemple.fr" });
    expect(await learnerEmail()).toBe("bob@exemple.fr");
  });
});
