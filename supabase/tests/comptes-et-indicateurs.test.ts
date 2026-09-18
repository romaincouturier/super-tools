import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createTestDb, loadFunctions, createAuthUser, actAs, type TestDb } from "./helpers/db";

/**
 * Drapeaux de sécurité du compte (RG-16, critère 20), fermeture des sessions
 * (W8.5), comptes dormants (RG-23) et indicateurs (chapitre 20).
 */
let db: TestDb;

const STAFF = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

beforeAll(async () => {
  db = await createTestDb();
  await loadFunctions(db, [
    // Repointé vers la migration qui porte réellement chaque fonction en
    // production (repris à l'identique par 093744/093920, jamais mis à jour
    // ici jusqu'ici).
    { migration: "20260918093744_74edf311-4768-484c-9744-4a7c2a2bbb53.sql", name: "mark_password_changed" },
    { migration: "20260918093744_74edf311-4768-484c-9744-4a7c2a2bbb53.sql", name: "request_password_change" },
    { migration: "20260918093920_2c7273dc-9e82-43f1-85cb-a3ab3baa6db7.sql", name: "revoke_other_sessions" },
    { migration: "20260918093920_2c7273dc-9e82-43f1-85cb-a3ab3baa6db7.sql", name: "list_dormant_learner_accounts" },
    { migration: "20260918160000_demolition_lien_magique.sql", name: "connexion_indicators" },
  ]);
});

beforeEach(async () => {
  await db.exec(`TRUNCATE profiles, user_security_metadata, training_participants, lms_progress,
    login_attempts, identity_resolution_log;
    DELETE FROM auth.sessions; DELETE FROM auth.users;`);
  await db.query("INSERT INTO profiles (user_id, email) VALUES ($1, $2)", [STAFF, "staff@supertilt.fr"]);
});

describe("drapeaux du compte", () => {
  it("enregistre qu'un mot de passe est défini et lève la contrainte", async () => {
    const id = await createAuthUser(db, "alice@exemple.fr", { passwordSet: false });
    await db.query("UPDATE user_security_metadata SET must_change_password = true WHERE user_id = $1", [id]);
    await actAs(db, { uid: id, email: "alice@exemple.fr" });
    await db.query("SELECT public.mark_password_changed()");
    const res = await db.query<{ password_set: boolean; must_change_password: boolean }>(
      "SELECT password_set, must_change_password FROM user_security_metadata WHERE user_id = $1", [id],
    );
    expect(res.rows[0]).toEqual({ password_set: true, must_change_password: false });
  });

  it("crée la ligne si elle n'existe pas encore", async () => {
    const id = await createAuthUser(db, "bob@exemple.fr");
    await actAs(db, { uid: id, email: "bob@exemple.fr" });
    await db.query("SELECT public.mark_password_changed()");
    const res = await db.query<{ count: string }>(
      "SELECT count(*) FROM user_security_metadata WHERE user_id = $1", [id],
    );
    expect(Number(res.rows[0].count)).toBe(1);
  });

  it("refuse d'écrire sans session", async () => {
    await actAs(db, null);
    await expect(db.query("SELECT public.mark_password_changed()")).rejects.toThrow(/Authentification/);
  });

  it("pose la contrainte de changement sur son propre compte, jamais un autre", async () => {
    const alice = await createAuthUser(db, "alice@exemple.fr");
    const bob = await createAuthUser(db, "bob@exemple.fr");
    await actAs(db, { uid: alice, email: "alice@exemple.fr" });
    await db.query("SELECT public.request_password_change()");
    const res = await db.query<{ user_id: string }>("SELECT user_id FROM user_security_metadata");
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].user_id).toBe(alice);
    expect(res.rows[0].user_id).not.toBe(bob);
  });
});

describe("revoke_other_sessions", () => {
  it("ferme les autres sessions et garde la courante (W8.5)", async () => {
    const id = await createAuthUser(db, "alice@exemple.fr");
    const current = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    await db.query("INSERT INTO auth.sessions (id, user_id) VALUES ($1, $2)", [current, id]);
    await db.query("INSERT INTO auth.sessions (user_id) VALUES ($1), ($1)", [id]);
    await db.query("SELECT set_config('test.uid', $1, false)", [id]);
    await db.query("SELECT set_config('test.jwt', $1, false)", [
      JSON.stringify({ email: "alice@exemple.fr", session_id: current }),
    ]);
    const res = await db.query<{ revoke_other_sessions: number }>("SELECT public.revoke_other_sessions()");
    expect(res.rows[0].revoke_other_sessions).toBe(2);
    const rest = await db.query<{ id: string }>("SELECT id FROM auth.sessions");
    expect(rest.rows.map((r) => r.id)).toEqual([current]);
  });

  it("ne touche jamais aux sessions d'un autre compte", async () => {
    const alice = await createAuthUser(db, "alice@exemple.fr");
    const bob = await createAuthUser(db, "bob@exemple.fr");
    await db.query("INSERT INTO auth.sessions (user_id) VALUES ($1)", [bob]);
    await actAs(db, { uid: alice, email: "alice@exemple.fr" });
    await db.query("SELECT public.revoke_other_sessions()");
    const rest = await db.query<{ count: string }>("SELECT count(*) FROM auth.sessions");
    expect(Number(rest.rows[0].count)).toBe(1);
  });
});

describe("list_dormant_learner_accounts", () => {
  beforeEach(async () => {
    await actAs(db, { uid: STAFF, email: "staff@supertilt.fr" });
  });

  it("signale un compte sans connexion depuis plus de trois ans", async () => {
    await db.query(
      "INSERT INTO auth.users (email, created_at, last_sign_in_at) VALUES ($1, now() - interval '5 years', now() - interval '4 years')",
      ["dormeur@exemple.fr"],
    );
    const res = await db.query<{ email: string }>("SELECT email FROM public.list_dormant_learner_accounts(3)");
    expect(res.rows.map((r) => r.email)).toEqual(["dormeur@exemple.fr"]);
  });

  it("épargne un compte actif", async () => {
    await createAuthUser(db, "actif@exemple.fr", { lastSignInAt: new Date().toISOString() });
    const res = await db.query("SELECT * FROM public.list_dormant_learner_accounts(3)");
    expect(res.rows).toHaveLength(0);
  });

  it("épargne un compte dont la progression est récente", async () => {
    await db.query(
      "INSERT INTO auth.users (email, created_at, last_sign_in_at) VALUES ($1, now() - interval '5 years', now() - interval '4 years')",
      ["revenu@exemple.fr"],
    );
    await db.query("INSERT INTO lms_progress (learner_email, updated_at) VALUES ($1, now())", ["revenu@exemple.fr"]);
    const res = await db.query("SELECT * FROM public.list_dormant_learner_accounts(3)");
    expect(res.rows).toHaveLength(0);
  });

  it("ne signale jamais un compte de l'équipe", async () => {
    await db.query(
      "INSERT INTO auth.users (id, email, created_at) VALUES ($1, $2, now() - interval '5 years')",
      [STAFF, "staff@supertilt.fr"],
    );
    const res = await db.query("SELECT * FROM public.list_dormant_learner_accounts(3)");
    expect(res.rows).toHaveLength(0);
  });

  it("est réservé à l'équipe", async () => {
    await actAs(db, { uid: "99999999-9999-9999-9999-999999999999", email: "apprenant@exemple.fr" });
    await expect(db.query("SELECT * FROM public.list_dormant_learner_accounts(3)")).rejects.toThrow(/équipe/);
  });
});

describe("connexion_indicators", () => {
  beforeEach(async () => {
    await actAs(db, { uid: STAFF, email: "staff@supertilt.fr" });
  });

  it("calcule le taux d'activation des comptes provisionnés", async () => {
    const a = await createAuthUser(db, "a@exemple.fr", { passwordSet: false, lastSignInAt: new Date().toISOString() });
    const b = await createAuthUser(db, "b@exemple.fr", { passwordSet: false });
    expect(a).not.toBe(b);
    const res = await db.query<{ connexion_indicators: Record<string, number> }>(
      "SELECT public.connexion_indicators(30)",
    );
    const ind = res.rows[0].connexion_indicators;
    expect(ind.provisioned_accounts).toBe(2);
    expect(ind.activated_accounts).toBe(1);
    expect(Number(ind.activation_rate)).toBe(50);
  });

  it("est réservé à l'équipe", async () => {
    await actAs(db, { uid: "99999999-9999-9999-9999-999999999999", email: "apprenant@exemple.fr" });
    await expect(db.query("SELECT public.connexion_indicators(30)")).rejects.toThrow(/équipe/);
  });
});
