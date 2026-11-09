import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createTestDb, loadFunctions, type TestDb } from "./helpers/db";

/**
 * Les deux lectures qui arment la supervision des crons.
 *
 * Elles sont extraites de leur migration, pas recopiées : si la migration
 * change de comportement, ces tests changent de résultat.
 *
 * La table net._http_response est posée ici à l'identique de pg_net, qui
 * n'existe pas dans la base de test. C'est la forme qui compte : un code HTTP,
 * un message d'erreur réseau, un corps, une date, et aucune URL — c'est
 * précisément cette absence qui empêche de nommer la fonction appelée.
 */
let db: TestDb;

const MIGRATION = "20261109160000_supervision_crons_http.sql";

async function freshness() {
  const res = await db.query<{ backup_freshness: Record<string, unknown> }>(
    "SELECT public.backup_freshness()",
  );
  return res.rows[0].backup_freshness;
}

async function httpFailures() {
  const res = await db.query<{ cron_http_failures_24h: Record<string, unknown> }>(
    "SELECT public.cron_http_failures_24h()",
  );
  return res.rows[0].cron_http_failures_24h;
}

beforeAll(async () => {
  db = await createTestDb();

  await db.exec(`
    CREATE TABLE IF NOT EXISTS backup_runs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      db_status text,
      db_finished_at timestamptz
    );

    CREATE SCHEMA IF NOT EXISTS net;
    CREATE TABLE IF NOT EXISTS net._http_response (
      id bigint PRIMARY KEY,
      status_code int,
      content_type text,
      headers jsonb,
      content text,
      timed_out boolean,
      error_msg text,
      created timestamptz NOT NULL DEFAULT now()
    );
  `);

  await loadFunctions(db, [
    { migration: MIGRATION, name: "backup_freshness" },
    { migration: MIGRATION, name: "cron_http_failures_24h" },
  ]);
});

beforeEach(async () => {
  await db.exec("TRUNCATE backup_runs; TRUNCATE net._http_response;");
});

describe("fraîcheur de la sauvegarde", () => {
  // Le cas qui a coûté six jours de silence : des lignes anciennes, aucune
  // récente, et rien qui le dise.
  it("déclare périmée une sauvegarde qui date de plus de 26 h", async () => {
    await db.exec(`
      INSERT INTO backup_runs (db_status, db_finished_at)
      VALUES ('success', now() - interval '6 days');
    `);
    const r = await freshness();
    expect(r.stale).toBe(true);
    expect(Number(r.age_hours)).toBeGreaterThan(140);
  });

  it("accepte une sauvegarde de la nuit", async () => {
    await db.exec(`
      INSERT INTO backup_runs (db_status, db_finished_at)
      VALUES ('success', now() - interval '3 hours');
    `);
    const r = await freshness();
    expect(r.stale).toBe(false);
  });

  // Une base jamais sauvegardée est le pire des cas, pas un cas neutre : sans
  // cette règle, un projet neuf passerait pour sauvegardé.
  it("traite l'absence totale de sauvegarde comme périmée", async () => {
    const r = await freshness();
    expect(r.stale).toBe(true);
    expect(r.last_success).toBeNull();
    expect(r.age_hours).toBeNull();
  });

  // Un run en échec ne vaut pas une sauvegarde : ne compter que db_status
  // 'success' est ce qui distingue « ça a tourné » de « ça a abouti ».
  it("ignore les passages qui n'ont pas abouti", async () => {
    await db.exec(`
      INSERT INTO backup_runs (db_status, db_finished_at)
      VALUES ('error', now() - interval '1 hour'),
             ('running', now() - interval '30 minutes');
    `);
    const r = await freshness();
    expect(r.stale).toBe(true);
    expect(r.last_success).toBeNull();
  });

  it("retient le passage réussi le plus récent", async () => {
    await db.exec(`
      INSERT INTO backup_runs (db_status, db_finished_at)
      VALUES ('success', now() - interval '10 days'),
             ('success', now() - interval '2 hours');
    `);
    const r = await freshness();
    expect(r.stale).toBe(false);
  });
});

describe("échecs HTTP des crons", () => {
  it("ne signale rien quand tout répond 200", async () => {
    await db.exec(`
      INSERT INTO net._http_response (id, status_code, content)
      VALUES (1, 200, '{"ok":true}'), (2, 204, NULL);
    `);
    const r = await httpFailures();
    expect(r.total).toBe(0);
    expect(r.groups).toEqual([]);
  });

  // Le cas réel : la même réponse, des centaines de fois, qu'aucun statut de
  // cron ne trahit puisque net.http_post réussit dès la mise en file.
  it("compte les rejets répétés et les regroupe", async () => {
    await db.exec(`
      INSERT INTO net._http_response (id, status_code, content)
      SELECT g, 401, '{"error":"Unauthorized"}' FROM generate_series(1, 174) g;
    `);
    const r = await httpFailures();
    expect(r.total).toBe(174);
    const groups = r.groups as Array<Record<string, unknown>>;
    expect(groups).toHaveLength(1);
    expect(groups[0].status_code).toBe(401);
    expect(groups[0].occurrences).toBe(174);
  });

  // Une requête qui n'a jamais abouti n'a pas de code : sans cette branche, un
  // délai dépassé ou une résolution impossible ne compterait nulle part.
  it("compte une réponse sans code HTTP", async () => {
    await db.exec(`
      INSERT INTO net._http_response (id, status_code, error_msg)
      VALUES (1, NULL, 'Timeout was reached');
    `);
    const r = await httpFailures();
    expect(r.total).toBe(1);
  });

  // Troisième branche, isolée des deux autres : ni code, ni message. Une
  // réponse qui ne dit rien n'est pas une réponse réussie, et sans la clause
  // sur le code nul elle ne serait comptée nulle part.
  it("compte une réponse muette, sans code ni message", async () => {
    await db.exec(`
      INSERT INTO net._http_response (id, status_code, error_msg)
      VALUES (1, NULL, NULL);
    `);
    const r = await httpFailures();
    expect(r.total).toBe(1);
  });

  // Branche distincte de la précédente, et c'est tout l'intérêt du test : un
  // code présent et correct accompagné d'une erreur ne passe par aucune des
  // deux autres conditions. Sans la clause error_msg, ce cas serait compté zéro.
  it("compte une erreur rapportée malgré un code correct", async () => {
    await db.exec(`
      INSERT INTO net._http_response (id, status_code, error_msg)
      VALUES (1, 200, 'Connection reset by peer');
    `);
    const r = await httpFailures();
    expect(r.total).toBe(1);
  });

  it("laisse de côté ce qui sort de la fenêtre de 24 h", async () => {
    await db.exec(`
      INSERT INTO net._http_response (id, status_code, content, created)
      VALUES (1, 401, '{"error":"Unauthorized"}', now() - interval '30 hours');
    `);
    const r = await httpFailures();
    expect(r.total).toBe(0);
  });

  it("sépare deux pannes distinctes", async () => {
    await db.exec(`
      INSERT INTO net._http_response (id, status_code, content)
      VALUES (1, 401, '{"error":"Unauthorized"}'),
             (2, 401, '{"error":"Unauthorized"}'),
             (3, 500, '{"error":"boom"}');
    `);
    const r = await httpFailures();
    expect(r.total).toBe(3);
    const groups = r.groups as Array<Record<string, unknown>>;
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.occurrences).sort()).toEqual([1, 2]);
  });
});
