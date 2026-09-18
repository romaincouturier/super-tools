import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createTestDb, type TestDb } from "./helpers/db";

/**
 * Le garde-fou de déploiement doit faire échouer la migration quand une colonne
 * référencée n'existe pas. Un garde-fou qui passe toujours ne garde rien : on
 * vérifie donc les deux sens.
 */
const GUARD = fs.readFileSync(
  path.resolve(__dirname, "../migrations/20260916100000_garde_fou_colonnes_connexion.sql"),
  "utf8",
);

let db: TestDb;

beforeEach(async () => {
  db = await createTestDb();
});

describe("garde-fou des colonnes", () => {
  it("passe quand toutes les colonnes existent", async () => {
    await expect(db.exec(GUARD)).resolves.toBeDefined();
  });

  it("échoue en nommant la colonne manquante", async () => {
    await db.exec("ALTER TABLE practice_poll_votes RENAME COLUMN author_email TO auteur_email;");
    await expect(db.exec(GUARD)).rejects.toThrow(/practice_poll_votes\.author_email/);
  });

  it("échoue aussi quand une table entière manque", async () => {
    await db.exec("DROP TABLE lms_work_deposits;");
    await expect(db.exec(GUARD)).rejects.toThrow(/lms_work_deposits\.learner_email/);
  });

  it("échoue sur une colonne lue par les indicateurs", async () => {
    await db.exec("ALTER TABLE user_security_metadata DROP COLUMN password_set;");
    await expect(db.exec(GUARD)).rejects.toThrow(/user_security_metadata\.password_set/);
  });
});
