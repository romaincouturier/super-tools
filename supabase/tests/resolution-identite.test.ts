import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createTestDb, loadFunctions, createAuthUser, type TestDb } from "./helpers/db";

/**
 * Chapitre 6 de la spécification : le service de résolution d'identité.
 * La fonction testée est celle du fichier de migration, exécutée sur Postgres.
 */
let db: TestDb;

const HASH_A = "hash-alice";
const HASH_B = "hash-bob";

async function resolve(email: string, hash = HASH_A, ip = "10.0.0.1") {
  const res = await db.query<{ resolve_login_identity: string }>(
    "SELECT public.resolve_login_identity($1, $2, $3)",
    [email, hash, ip],
  );
  return res.rows[0].resolve_login_identity;
}

beforeAll(async () => {
  db = await createTestDb();
  await loadFunctions(db, [
    // La fonction est réécrite (CREATE OR REPLACE) dans une migration plus
    // récente : c'est elle qui porte le comportement réellement déployé.
    { migration: "20260918110000_seuil_resolution_identite.sql", name: "resolve_login_identity" },
  ]);
});

beforeEach(async () => {
  await db.exec("TRUNCATE identity_resolution_log, learner_magic_links, lms_enrollments, training_participants, user_security_metadata; DELETE FROM auth.users;");
});

describe("resolve_login_identity", () => {
  it("aiguille vers le mot de passe quand le compte en a un", async () => {
    await createAuthUser(db, "alice@exemple.fr", { passwordSet: true });
    expect(await resolve("alice@exemple.fr")).toBe("password");
  });

  it("aiguille vers le lien quand le compte n'a pas de mot de passe", async () => {
    await createAuthUser(db, "bob@exemple.fr", { passwordSet: false });
    expect(await resolve("bob@exemple.fr")).toBe("link");
  });

  it("considère qu'un compte antérieur au drapeau a un mot de passe", async () => {
    await createAuthUser(db, "ancien@exemple.fr");
    expect(await resolve("ancien@exemple.fr")).toBe("password");
  });

  it("propose l'activation à un participant connu sans compte", async () => {
    await db.query("INSERT INTO training_participants (email) VALUES ($1)", ["claire@exemple.fr"]);
    expect(await resolve("claire@exemple.fr")).toBe("activation");
  });

  it("propose l'activation à un inscrit Academy sans compte", async () => {
    await db.query("INSERT INTO lms_enrollments (learner_email) VALUES ($1)", ["david@exemple.fr"]);
    expect(await resolve("david@exemple.fr")).toBe("activation");
  });

  it("ne connaît pas une adresse absente de tous les référentiels", async () => {
    expect(await resolve("inconnu@exemple.fr")).toBe("unknown");
  });

  it("ignore la casse et les espaces de bord (RG-01)", async () => {
    await createAuthUser(db, "alice@exemple.fr", { passwordSet: true });
    expect(await resolve("  Alice@EXEMPLE.FR  ")).toBe("password");
  });

  it("freine au-delà de dix résolutions par adresse et par heure", async () => {
    await createAuthUser(db, "alice@exemple.fr", { passwordSet: true });
    for (let i = 0; i < 10; i += 1) {
      expect(await resolve("alice@exemple.fr")).toBe("password");
    }
    expect(await resolve("alice@exemple.fr")).toBe("throttled");
  });

  it("ne freine pas une autre adresse depuis la même IP tant que le quota IP tient", async () => {
    await createAuthUser(db, "alice@exemple.fr", { passwordSet: true });
    await createAuthUser(db, "bob@exemple.fr", { passwordSet: true });
    for (let i = 0; i < 10; i += 1) await resolve("alice@exemple.fr", HASH_A);
    expect(await resolve("bob@exemple.fr", HASH_B)).toBe("password");
  });

  it("freine au-delà de vingt résolutions depuis la même adresse IP", async () => {
    await db.query(
      `INSERT INTO identity_resolution_log (email_hash, ip_address, state)
       SELECT 'autre-' || g, '10.0.0.9', 'unknown' FROM generate_series(1, 20) g`,
    );
    expect(await resolve("inconnu@exemple.fr", HASH_B, "10.0.0.9")).toBe("throttled");
  });

  it("oublie les tentatives de plus d'une heure", async () => {
    await createAuthUser(db, "alice@exemple.fr", { passwordSet: true });
    await db.query(
      `INSERT INTO identity_resolution_log (email_hash, ip_address, state, resolved_at)
       SELECT $1, '10.0.0.1', 'password', now() - interval '2 hours' FROM generate_series(1, 10)`,
      [HASH_A],
    );
    expect(await resolve("alice@exemple.fr")).toBe("password");
  });

  it("journalise l'empreinte, jamais l'adresse en clair (RG-24)", async () => {
    await createAuthUser(db, "alice@exemple.fr", { passwordSet: true });
    await resolve("alice@exemple.fr");
    const rows = await db.query<{ email_hash: string; state: string }>(
      "SELECT email_hash, state FROM identity_resolution_log",
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].email_hash).toBe(HASH_A);
    expect(JSON.stringify(rows.rows)).not.toContain("alice@exemple.fr");
  });

  it("ne rend rien d'autre qu'un état d'aiguillage (RG-26)", async () => {
    await createAuthUser(db, "alice@exemple.fr", { passwordSet: true });
    const res = await db.query("SELECT public.resolve_login_identity($1, $2, $3) AS state", [
      "alice@exemple.fr", HASH_A, "10.0.0.1",
    ]);
    expect(Object.keys(res.rows[0] as object)).toEqual(["state"]);
    expect(["password", "link", "activation", "unknown", "throttled"]).toContain(
      (res.rows[0] as { state: string }).state,
    );
  });
});
