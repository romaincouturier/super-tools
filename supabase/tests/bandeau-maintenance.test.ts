import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createTestDb, loadFunctions, actAs, type TestDb } from "./helpers/db";

/**
 * Le bandeau d'information doit être lisible sans session, et la fonction qui
 * le sert ne doit rien exposer d'autre que sa liste blanche.
 */
let db: TestDb;

async function publicSetting(key: string) {
  const res = await db.query<{ get_app_setting_public: string | null }>(
    "SELECT public.get_app_setting_public($1)", [key],
  );
  return res.rows[0].get_app_setting_public;
}

beforeAll(async () => {
  db = await createTestDb();
  await loadFunctions(db, [
    { migration: "20260916080000_bandeau_maintenance_connexion.sql", name: "get_app_setting_public" },
  ]);
});

beforeEach(async () => {
  await db.exec("TRUNCATE app_settings;");
  await db.query("INSERT INTO app_settings (setting_key, setting_value) VALUES ($1, $2)", [
    "maintenance_banner_enabled", "true",
  ]);
  await db.query("INSERT INTO app_settings (setting_key, setting_value) VALUES ($1, $2)", [
    "maintenance_banner_message", "Nous faisons quelques travaux.",
  ]);
  await db.query("INSERT INTO app_settings (setting_key, setting_value) VALUES ($1, $2)", [
    "resend_api_key", "secret-a-ne-jamais-sortir",
  ]);
  await actAs(db, null);
});

describe("get_app_setting_public", () => {
  it("rend l'état du bandeau sans session", async () => {
    expect(await publicSetting("maintenance_banner_enabled")).toBe("true");
  });

  it("rend le texte du bandeau sans session", async () => {
    expect(await publicSetting("maintenance_banner_message")).toBe("Nous faisons quelques travaux.");
  });

  it("ne rend rien pour une clé hors liste blanche", async () => {
    expect(await publicSetting("resend_api_key")).toBeNull();
  });

  it("ne rend rien pour une clé absente", async () => {
    expect(await publicSetting("maintenance_banner_color")).toBeNull();
  });
});
