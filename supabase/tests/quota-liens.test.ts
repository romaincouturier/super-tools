import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createTestDb, loadFunctions, type TestDb } from "./helpers/db";

/** RG-08 : le quota d'envoi de liens est tenu côté serveur, pas dans le navigateur. */
let db: TestDb;

async function quota(hash: string, ip = "10.0.0.1") {
  const res = await db.query<{ check_link_quota: boolean }>(
    "SELECT public.check_link_quota($1, $2)",
    [hash, ip],
  );
  return res.rows[0].check_link_quota;
}

beforeAll(async () => {
  db = await createTestDb();
  await loadFunctions(db, [
    { migration: "20260915140000_recette_p4_quota_purge_sessions.sql", name: "check_link_quota" },
    { migration: "20260914170000_lot3_resolution_identite.sql", name: "purge_identity_resolution_log" },
  ]);
});

beforeEach(async () => {
  await db.exec("TRUNCATE identity_resolution_log;");
});

describe("check_link_quota", () => {
  it("laisse passer les trois premiers envois pour une adresse", async () => {
    expect(await quota("alice")).toBe(true);
    expect(await quota("alice")).toBe(true);
    expect(await quota("alice")).toBe(true);
  });

  it("refuse le quatrième envoi dans l'heure", async () => {
    for (let i = 0; i < 3; i += 1) await quota("alice");
    expect(await quota("alice")).toBe(false);
  });

  it("n'enregistre rien quand il refuse : le quota ne s'auto-alimente pas", async () => {
    for (let i = 0; i < 3; i += 1) await quota("alice");
    await quota("alice");
    const rows = await db.query<{ count: string }>(
      "SELECT count(*) FROM identity_resolution_log WHERE email_hash = 'alice'",
    );
    expect(Number(rows.rows[0].count)).toBe(3);
  });

  it("oublie les envois de plus d'une heure", async () => {
    await db.query(
      `INSERT INTO identity_resolution_log (email_hash, ip_address, state, resolved_at)
       SELECT 'alice', '10.0.0.1', 'link_sent', now() - interval '90 minutes' FROM generate_series(1, 3)`,
    );
    expect(await quota("alice")).toBe(true);
  });

  it("refuse au-delà de dix envois depuis la même adresse IP", async () => {
    await db.query(
      `INSERT INTO identity_resolution_log (email_hash, ip_address, state)
       SELECT 'autre-' || g, '10.0.0.7', 'link_sent' FROM generate_series(1, 10) g`,
    );
    expect(await quota("nouvelle-adresse", "10.0.0.7")).toBe(false);
  });

  it("ne compte pas les résolutions d'identité dans le quota d'envoi", async () => {
    await db.query(
      `INSERT INTO identity_resolution_log (email_hash, ip_address, state)
       SELECT 'alice', '10.0.0.1', 'password' FROM generate_series(1, 5)`,
    );
    expect(await quota("alice")).toBe(true);
  });

  it("refuse une empreinte absente", async () => {
    expect(await quota("")).toBe(false);
  });
});

describe("purge_identity_resolution_log", () => {
  it("efface les traces de plus de 30 jours et garde les récentes (RG-24)", async () => {
    await db.query(
      `INSERT INTO identity_resolution_log (email_hash, ip_address, state, resolved_at)
       VALUES ('vieille', '10.0.0.1', 'password', now() - interval '31 days'),
              ('recente', '10.0.0.1', 'password', now() - interval '29 days')`,
    );
    const res = await db.query<{ purge_identity_resolution_log: number }>(
      "SELECT public.purge_identity_resolution_log()",
    );
    expect(res.rows[0].purge_identity_resolution_log).toBe(1);
    const rest = await db.query<{ email_hash: string }>("SELECT email_hash FROM identity_resolution_log");
    expect(rest.rows.map((r) => r.email_hash)).toEqual(["recente"]);
  });
});
