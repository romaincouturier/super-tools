import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const admin = "00000000-0000-0000-0000-000000000001";
const learner = "00000000-0000-0000-0000-000000000002";
const id = "00000000-0000-0000-0000-000000000003";
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE FUNCTION public.is_admin(id uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT id = '${admin}'::uuid $$;`);
  await db.exec(readFileSync("drizzle/migrations/0081_elementor_webhook_inbox.sql", "utf8"));
  await db.query("INSERT INTO elementor_webhook_inbox(id,submission) VALUES ($1,$2)", [id, { raw_payload: "Demande à conserver" }]);
}, 15000);
beforeEach(async () => { await db.exec("RESET ROLE"); await db.query("SELECT set_config('test.uid',$1,false)", [learner]); });
afterAll(async () => { await db.close(); });

describe("Conservation privée des formulaires Elementor", () => {
  it("autorise uniquement la lecture des administrateurs", async () => {
    await db.query("SELECT set_config('test.uid',$1,false)", [admin]);
    await db.exec("SET ROLE authenticated");
    expect((await db.query("SELECT submission FROM elementor_webhook_inbox WHERE id=$1", [id])).rows).toEqual([{ submission: { raw_payload: "Demande à conserver" } }]);
    await expect(db.query("UPDATE elementor_webhook_inbox SET status='processed' WHERE id=$1", [id])).rejects.toThrow(/permission denied/);
  });

  it("masque les demandes aux comptes non administrateurs", async () => {
    await db.exec("SET ROLE authenticated");
    expect((await db.query("SELECT * FROM elementor_webhook_inbox")).rows).toEqual([]);
  });

  it("refuse la lecture et l'écriture anonymes", async () => {
    await db.exec("SET ROLE anon");
    await expect(db.query("SELECT * FROM elementor_webhook_inbox")).rejects.toThrow(/permission denied/);
    await expect(db.query("INSERT INTO elementor_webhook_inbox(submission) VALUES ('{}')")).rejects.toThrow(/permission denied/);
  });

  it("permet au serveur de tracer une erreur sans perdre le formulaire brut", async () => {
    await db.exec("SET ROLE service_role");
    await db.query("UPDATE elementor_webhook_inbox SET status='error', error_message=$1 WHERE id=$2", ["Échec création CRM", id]);
    expect((await db.query("SELECT status,error_message,submission FROM elementor_webhook_inbox WHERE id=$1", [id])).rows).toEqual([
      { status: "error", error_message: "Échec création CRM", submission: { raw_payload: "Demande à conserver" } },
    ]);
    await expect(db.query("UPDATE elementor_webhook_inbox SET status='ignored' WHERE id=$1", [id])).rejects.toThrow(/check constraint/);
  });
});