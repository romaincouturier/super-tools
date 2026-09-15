import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createTestDb, loadFunctions, createAuthUser, actAs, type TestDb } from "./helpers/db";

/** W13 et RG-19 : le changement d'adresse est atomique, ou n'a pas lieu. */
let db: TestDb;

const STAFF = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

async function change(oldEmail: string, newEmail: string, userId: string | null = null) {
  const res = await db.query<{ change_learner_email: { rows_moved: number } }>(
    "SELECT public.change_learner_email($1, $2, $3)",
    [oldEmail, newEmail, userId],
  );
  return res.rows[0].change_learner_email;
}

beforeAll(async () => {
  db = await createTestDb();
  await loadFunctions(db, [
    { migration: "20260915100000_lot6_adresse_indicateurs.sql", name: "change_learner_email" },
  ]);
});

beforeEach(async () => {
  await db.exec(`TRUNCATE profiles, training_participants, lms_enrollments, lms_progress,
    learner_profiles, questionnaire_besoins, training_evaluations, practice_posts,
    learner_magic_links; DELETE FROM auth.users; DELETE FROM auth.sessions;`);
  await db.query("INSERT INTO profiles (user_id, email) VALUES ($1, $2)", [STAFF, "staff@supertilt.fr"]);
  await actAs(db, { uid: STAFF, email: "staff@supertilt.fr" });
});

describe("change_learner_email", () => {
  it("déplace l'adresse dans tous les référentiels", async () => {
    await db.query("INSERT INTO training_participants (email) VALUES ('alice@ancien.fr')");
    await db.query("INSERT INTO lms_enrollments (learner_email) VALUES ('alice@ancien.fr')");
    await db.query("INSERT INTO lms_progress (learner_email) VALUES ('alice@ancien.fr')");
    await db.query("INSERT INTO questionnaire_besoins (email) VALUES ('alice@ancien.fr')");
    await db.query("INSERT INTO practice_posts (author_email) VALUES ('alice@ancien.fr')");

    const result = await change("alice@ancien.fr", "alice@nouveau.fr");
    expect(result.rows_moved).toBe(5);

    const reste = await db.query<{ count: string }>(
      `SELECT (SELECT count(*) FROM training_participants WHERE email = 'alice@ancien.fr')
            + (SELECT count(*) FROM lms_enrollments WHERE learner_email = 'alice@ancien.fr')
            + (SELECT count(*) FROM lms_progress WHERE learner_email = 'alice@ancien.fr')
            + (SELECT count(*) FROM questionnaire_besoins WHERE email = 'alice@ancien.fr')
            + (SELECT count(*) FROM practice_posts WHERE author_email = 'alice@ancien.fr') AS count`,
    );
    expect(Number(reste.rows[0].count)).toBe(0);
  });

  it("invalide les liens envoyés à l'ancienne adresse", async () => {
    await db.query("INSERT INTO training_participants (email) VALUES ('alice@ancien.fr')");
    await db.query("INSERT INTO learner_magic_links (email) VALUES ('alice@ancien.fr')");
    await change("alice@ancien.fr", "alice@nouveau.fr");
    const res = await db.query<{ used_at: string | null }>("SELECT used_at FROM learner_magic_links");
    expect(res.rows[0].used_at).not.toBeNull();
  });

  it("ferme les sessions ouvertes du compte", async () => {
    const id = await createAuthUser(db, "alice@ancien.fr");
    await db.query("INSERT INTO auth.sessions (user_id) VALUES ($1)", [id]);
    await db.query("INSERT INTO training_participants (email) VALUES ('alice@ancien.fr')");
    await change("alice@ancien.fr", "alice@nouveau.fr", id);
    const res = await db.query<{ count: string }>("SELECT count(*) FROM auth.sessions");
    expect(Number(res.rows[0].count)).toBe(0);
  });

  it("refuse si la nouvelle adresse appartient déjà à un compte", async () => {
    await createAuthUser(db, "occupee@exemple.fr");
    await db.query("INSERT INTO training_participants (email) VALUES ('alice@ancien.fr')");
    await expect(change("alice@ancien.fr", "occupee@exemple.fr")).rejects.toThrow(/déjà utilisée/);
  });

  it("refuse si la nouvelle adresse est déjà celle d'un participant", async () => {
    await db.query("INSERT INTO training_participants (email) VALUES ('bob@exemple.fr')");
    await db.query("INSERT INTO training_participants (email) VALUES ('alice@ancien.fr')");
    await expect(change("alice@ancien.fr", "bob@exemple.fr")).rejects.toThrow(/déjà utilisée/);
  });

  it("ne change rien quand il refuse", async () => {
    await db.query("INSERT INTO training_participants (email) VALUES ('bob@exemple.fr')");
    await db.query("INSERT INTO training_participants (email) VALUES ('alice@ancien.fr')");
    await expect(change("alice@ancien.fr", "bob@exemple.fr")).rejects.toThrow();
    const res = await db.query<{ count: string }>(
      "SELECT count(*) FROM training_participants WHERE email = 'alice@ancien.fr'",
    );
    expect(Number(res.rows[0].count)).toBe(1);
  });

  it("refuse une adresse mal formée", async () => {
    await expect(change("alice@ancien.fr", "pas-une-adresse")).rejects.toThrow(/invalide/);
  });

  it("refuse deux adresses identiques", async () => {
    await expect(change("alice@ancien.fr", "Alice@Ancien.fr")).rejects.toThrow(/identiques/);
  });

  it("n'est ouvert qu'à l'équipe", async () => {
    await actAs(db, { uid: "99999999-9999-9999-9999-999999999999", email: "apprenant@exemple.fr" });
    await expect(change("alice@ancien.fr", "alice@nouveau.fr")).rejects.toThrow(/équipe/);
  });

  it("normalise les adresses reçues (RG-01)", async () => {
    await db.query("INSERT INTO training_participants (email) VALUES ('alice@ancien.fr')");
    await change("  Alice@Ancien.FR ", "  Alice@Nouveau.FR ");
    const res = await db.query<{ email: string }>("SELECT email FROM training_participants");
    expect(res.rows[0].email).toBe("alice@nouveau.fr");
  });
});
