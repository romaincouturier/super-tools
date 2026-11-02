import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createTestDb, loadFunctions, actAs, createAuthUser, type TestDb } from "./helpers/db";

/**
 * Gardes staff de get_previous_trainer_evaluations et get_staff_directory
 * (20261102120000_staff_guard_trainer_evals_directory.sql). Un apprenant a une
 * session : sans la garde, il lisait les évaluations formateur et l'annuaire
 * staff. Les autres RPC internes sont couvertes par rpc-internes-staff.test.ts.
 */
const MIGRATION = "20261102120000_staff_guard_trainer_evals_directory.sql";
const PREVIOUS_EVALS = "SELECT public.get_previous_trainer_evaluations('f@exemple.fr', gen_random_uuid())";
const DIRECTORY = "SELECT * FROM public.get_staff_directory()";

let db: TestDb;
let admin: string;
let staff: string;
let learner: string;

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    CREATE TABLE trainer_evaluations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), trainer_email text, status text,
      points_forts text, axes_amelioration text, commentaires text);
    ALTER TABLE profiles ADD COLUMN first_name text, ADD COLUMN last_name text, ADD COLUMN display_name text;
  `);
  await loadFunctions(db, [
    { migration: "20260612154854_6408dfb1-3ac8-4417-a066-a7174f1ca312.sql", name: "is_staff_user" },
    { migration: MIGRATION, name: "get_previous_trainer_evaluations" },
    { migration: MIGRATION, name: "get_staff_directory" },
  ]);

  admin = await createAuthUser(db, "admin@supertilt.fr");
  staff = await createAuthUser(db, "staff@supertilt.fr");
  learner = await createAuthUser(db, "alice@exemple.fr");
  await db.query("INSERT INTO profiles (user_id, email, is_admin, first_name) VALUES ($1, 'admin@supertilt.fr', true, 'Ada')", [admin]);
  await db.query("INSERT INTO profiles (user_id, email, first_name) VALUES ($1, 'staff@supertilt.fr', 'Sam')", [staff]);
  await db.query("INSERT INTO user_module_access (user_id) VALUES ($1)", [staff]);
  // Un apprenant peut avoir une ligne profiles : elle ne vaut pas droit.
  await db.query("INSERT INTO profiles (user_id, email) VALUES ($1, 'alice@exemple.fr')", [learner]);
  await db.query("INSERT INTO trainer_evaluations (trainer_email, status, points_forts) VALUES ('f@exemple.fr', 'soumis', 'clair')");
});

beforeEach(async () => {
  await actAs(db, null);
});

describe("RPC réservées au staff", () => {
  for (const sql of [PREVIOUS_EVALS, DIRECTORY]) {
    it(`refuse un anonyme : ${sql}`, async () => {
      await expect(db.query(sql)).rejects.toThrow(/Accès refusé/);
    });

    it(`refuse un apprenant connecté avec une ligne profiles : ${sql}`, async () => {
      await actAs(db, { uid: learner, email: "alice@exemple.fr" });
      await expect(db.query(sql)).rejects.toThrow(/Accès refusé/);
    });
  }

  it("un compte avec module lit les évaluations formateur précédentes", async () => {
    await actAs(db, { uid: staff });
    const res = await db.query<{ get_previous_trainer_evaluations: unknown }>(PREVIOUS_EVALS);
    expect(res.rows[0].get_previous_trainer_evaluations).toEqual([
      { points_forts: "clair", axes_amelioration: null, commentaires: null },
    ]);
  });

  it("un admin lit l'annuaire staff", async () => {
    await actAs(db, { uid: admin });
    const res = await db.query<{ first_name: string | null }>(DIRECTORY);
    expect(res.rows.map((r) => r.first_name)).toEqual(["Ada", "Sam", null]);
  });
});
