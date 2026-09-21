import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createTestDb, loadFunctions, type TestDb } from "./helpers/db";

/**
 * Score de fraîcheur de la veille — règle [058] : la fonction est jouée sur un
 * vrai Postgres, chargée depuis sa migration.
 *
 * L'invariant qui a motivé la réécriture : le score est RECALCULÉ à partir de
 * l'âge, il n'est pas décrémenté. Un travail planifié peut être rejoué (reprise
 * après incident, exécution manuelle, cron déclenché deux fois) et doit donner
 * le même résultat. La version d'origine soustrayait l'âge à chaque passage,
 * donc dix exécutions dans la journée effondraient tous les scores.
 */
let db: TestDb;

const WATCH_ITEMS = `
CREATE TABLE watch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  relevance_score numeric(5,2) NOT NULL DEFAULT 100.00,
  updated_at timestamptz NOT NULL DEFAULT now()
);
`;

/** Dépose un contenu mis à jour il y a `ageDays` jours. */
async function addItem(title: string, ageDays: number) {
  await db.query(
    "INSERT INTO watch_items (title, updated_at) VALUES ($1, now() - ($2 || ' days')::interval)",
    [title, String(ageDays)],
  );
}

async function decay(times = 1) {
  for (let i = 0; i < times; i++) {
    await db.query("SELECT public.decay_watch_relevance()");
  }
}

async function scoreOf(title: string): Promise<number> {
  const res = await db.query<{ relevance_score: string }>(
    "SELECT relevance_score FROM watch_items WHERE title = $1",
    [title],
  );
  return Number(res.rows[0].relevance_score);
}

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(WATCH_ITEMS);
  await loadFunctions(db, [
    {
      migration: "20260921120000_schedule_watch_relevance_decay.sql",
      name: "decay_watch_relevance",
    },
  ]);
});

beforeEach(async () => {
  await db.exec("TRUNCATE watch_items;");
});

describe("decay_watch_relevance", () => {
  it("laisse à 100 un contenu déposé aujourd'hui", async () => {
    await addItem("du jour", 0);
    await decay();
    expect(await scoreOf("du jour")).toBeCloseTo(100, 1);
  });

  it("retire un demi-point par jour d'âge", async () => {
    await addItem("dix jours", 10);
    await addItem("cent jours", 100);
    await decay();
    expect(await scoreOf("dix jours")).toBeCloseTo(95, 1);
    expect(await scoreOf("cent jours")).toBeCloseTo(50, 1);
  });

  it("donne le même score quel que soit le nombre d'exécutions", async () => {
    await addItem("rejoué", 30);
    await decay();
    const apresUnPassage = await scoreOf("rejoué");

    await decay(10);
    expect(await scoreOf("rejoué")).toBeCloseTo(apresUnPassage, 2);
    expect(apresUnPassage).toBeCloseTo(85, 1);
  });

  it("plancher à zéro au-delà de 200 jours, jamais de score négatif", async () => {
    await addItem("archive", 400);
    await decay(3);
    expect(await scoreOf("archive")).toBe(0);
  });

  it("fait remonter un contenu remis à jour", async () => {
    await addItem("ressorti", 300);
    await decay();
    expect(await scoreOf("ressorti")).toBe(0);

    await db.query("UPDATE watch_items SET updated_at = now() WHERE title = $1", ["ressorti"]);
    await decay();
    expect(await scoreOf("ressorti")).toBeCloseTo(100, 1);
  });
});
