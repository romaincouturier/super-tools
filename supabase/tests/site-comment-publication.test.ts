import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const EVALUATION = "1d80871e-e2d6-44c0-bdd0-7bdf7ffaa326";
const OTHER_EVALUATION = "44dfb101-bbf2-4004-bbdd-1a5516b054ba";
const ROMAIN = "81d0328b-7651-4deb-95c0-c7ac81eb952e";
const EMMANUELLE = "c894a7ec-4680-4a9e-bed7-4aad7af12909";
let db: PGlite;

beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(`
    CREATE TABLE training_evaluations(id uuid PRIMARY KEY, site_comment_published_at timestamptz, site_comment_published_by uuid);
    CREATE TABLE daily_actions(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, action_date date NOT NULL,
      category text NOT NULL, entity_type text NOT NULL, entity_id text NOT NULL,
      is_completed boolean NOT NULL DEFAULT false, completed_at timestamptz,
      auto_completed boolean NOT NULL DEFAULT false
    );
  `);
  await db.exec(fs.readFileSync("drizzle/migrations/0044_evaluation_site_comment_tracking.sql", "utf8"));
});

afterAll(async () => { await db?.close(); });

beforeEach(async () => {
  await db.exec("DELETE FROM daily_actions; DELETE FROM training_evaluations;");
  await db.query("INSERT INTO training_evaluations(id) VALUES ($1), ($2)", [EVALUATION, OTHER_EVALUATION]);
});

describe("Clôture des alertes commentaires_site", () => {
  it("conserve la date et l'auteur de publication enregistrés", async () => {
    await db.query(
      "UPDATE training_evaluations SET site_comment_published_at = $1, site_comment_published_by = $2 WHERE id = $3",
      ["2026-11-23T08:00:00Z", EMMANUELLE, EVALUATION],
    );
    const { rows } = await db.query<{ site_comment_published_at: Date; site_comment_published_by: string }>(
      "SELECT site_comment_published_at, site_comment_published_by FROM training_evaluations WHERE id = $1",
      [EVALUATION],
    );
    expect(rows[0].site_comment_published_at.toISOString()).toBe("2026-11-23T08:00:00.000Z");
    expect(rows[0].site_comment_published_by).toBe(EMMANUELLE);
  });

  it("clôt les alertes ouvertes de Romain et Emmanuelle, y compris les jours précédents", async () => {
    await db.query(`
      INSERT INTO daily_actions(user_id, action_date, category, entity_type, entity_id)
      SELECT user_id, action_date, 'commentaires_site', 'training_evaluation', $1
      FROM (VALUES ($2::uuid), ($3::uuid)) AS users(user_id),
           (VALUES ('2026-11-19'::date), ('2026-11-20'::date), ('2026-11-23'::date)) AS dates(action_date)
    `, [EVALUATION, ROMAIN, EMMANUELLE]);
    await db.query(
      "INSERT INTO daily_actions(user_id, action_date, category, entity_type, entity_id) VALUES ($1, '2026-11-23', 'commentaires_site', 'training_evaluation', $2)",
      [ROMAIN, OTHER_EVALUATION],
    );

    await db.query(
      "UPDATE training_evaluations SET site_comment_published_at = now(), site_comment_published_by = $1 WHERE id = $2",
      [EMMANUELLE, EVALUATION],
    );

    const target = await db.query<{ open_count: number; automatic_count: number }>(
      "SELECT count(*) FILTER (WHERE NOT is_completed)::int AS open_count, count(*) FILTER (WHERE is_completed AND auto_completed)::int AS automatic_count FROM daily_actions WHERE entity_id = $1",
      [EVALUATION],
    );
    expect(target.rows[0]).toEqual({ open_count: 0, automatic_count: 6 });
    const other = await db.query<{ is_completed: boolean }>(
      "SELECT is_completed FROM daily_actions WHERE entity_id = $1",
      [OTHER_EVALUATION],
    );
    expect(other.rows[0].is_completed).toBe(false);
  });
});
