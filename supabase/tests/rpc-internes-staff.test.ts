import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createTestDb, loadFunctions, createAuthUser, actAs, type TestDb } from "./helpers/db";

/**
 * Fonctions internes réservées à l'équipe (règle [063]) : une session
 * d'apprenant ne suffit pas, l'état des tâches planifiées contient leurs
 * secrets.
 */
let db: TestDb;

const STAFF = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const MIGRATION = "20260924190000_staff_guard_internal_rpcs.sql";

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    CREATE SCHEMA cron;
    CREATE TABLE cron.job (jobid bigint, jobname text, schedule text, command text, active boolean);
    CREATE TABLE cron.job_run_details (jobid bigint, status text, start_time timestamptz, end_time timestamptz, return_message text);
    CREATE TABLE feature_usage (feature_name text, metadata jsonb, created_at timestamptz DEFAULT now());
    INSERT INTO cron.job VALUES (1, 'relance', '0 8 * * *', 'select net.http_post(headers := ''{"x-cron-secret": "s3cr3t"}'')', true);
    INSERT INTO feature_usage (feature_name, metadata) VALUES ('page_view', '{"path": "/crm/cartes"}');
  `);
  await loadFunctions(db, [
    { migration: "20260612154854_6408dfb1-3ac8-4417-a066-a7174f1ca312.sql", name: "is_staff_user" },
    { migration: MIGRATION, name: "get_cron_status" },
    { migration: MIGRATION, name: "get_db_size" },
    { migration: MIGRATION, name: "learner_accounts_for_emails" },
    { migration: MIGRATION, name: "get_nav_usage_counts" },
  ]);
});

beforeEach(async () => {
  await db.exec(`TRUNCATE profiles, user_module_access; DELETE FROM auth.users;`);
  await db.query("INSERT INTO profiles (user_id, email, is_admin) VALUES ($1, $2, true)", [STAFF, "staff@supertilt.fr"]);
});

async function asLearner() {
  const id = await createAuthUser(db, "apprenant@exemple.fr");
  await actAs(db, { uid: id, email: "apprenant@exemple.fr" });
}

describe("get_cron_status", () => {
  it("refuse un compte connecté sans droit, secrets compris", async () => {
    await asLearner();
    await expect(db.query("SELECT public.get_cron_status()")).rejects.toThrow("Réservé à l'équipe SuperTilt");
  });

  it("répond à l'équipe", async () => {
    await actAs(db, { uid: STAFF, email: "staff@supertilt.fr" });
    const res = await db.query<{ s: { jobs: { jobname: string }[] } }>("SELECT public.get_cron_status() AS s");
    expect(res.rows[0].s.jobs.map((j) => j.jobname)).toEqual(["relance"]);
  });
});

describe("get_db_size", () => {
  it("refuse un apprenant, accepte l'équipe et le service role", async () => {
    await asLearner();
    await expect(db.query("SELECT public.get_db_size()")).rejects.toThrow("Réservé à l'équipe SuperTilt");

    await actAs(db, { uid: STAFF, email: "staff@supertilt.fr" });
    const staff = await db.query<{ s: { total_size_bytes: number } }>("SELECT public.get_db_size() AS s");
    expect(staff.rows[0].s.total_size_bytes).toBeGreaterThan(0);

    await actAs(db, null);
    await db.query("SELECT set_config('test.jwt', $1, false)", [JSON.stringify({ role: "service_role" })]);
    const service = await db.query<{ s: { total_size_bytes: number } }>("SELECT public.get_db_size() AS s");
    expect(service.rows[0].s.total_size_bytes).toBeGreaterThan(0);
  });
});

describe("learner_accounts_for_emails et get_nav_usage_counts", () => {
  it("ne renvoient rien à un apprenant", async () => {
    await asLearner();
    const accounts = await db.query("SELECT * FROM public.learner_accounts_for_emails(ARRAY['apprenant@exemple.fr'])");
    const nav = await db.query("SELECT * FROM public.get_nav_usage_counts()");
    expect(accounts.rows).toEqual([]);
    expect(nav.rows).toEqual([]);
  });

  it("répondent à l'équipe", async () => {
    await createAuthUser(db, "Apprenant@Exemple.fr");
    await actAs(db, { uid: STAFF, email: "staff@supertilt.fr" });
    const accounts = await db.query<{ learner_accounts_for_emails: string }>(
      "SELECT * FROM public.learner_accounts_for_emails(ARRAY['apprenant@exemple.fr', 'inconnu@exemple.fr'])",
    );
    const nav = await db.query<{ segment: string; clicks: string }>("SELECT * FROM public.get_nav_usage_counts()");
    expect(accounts.rows.map((r) => r.learner_accounts_for_emails)).toEqual(["apprenant@exemple.fr"]);
    expect(nav.rows.map((r) => [r.segment, Number(r.clicks)])).toEqual([["crm", 1]]);
  });
});
