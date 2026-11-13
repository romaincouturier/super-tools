import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

describe("Droits des contrôles de transcripts", () => {
  it("refuse lecture et écriture apprenant, autorise lecture du module sans écriture directe", async () => {
    const db = new PGlite();
    await db.exec(`CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE FUNCTION public.is_admin(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
      CREATE FUNCTION public.has_module_access(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.module',true) = 'yes' $$;`);
    await db.exec(readFileSync("drizzle/migrations/0066_transcript_inventory_controls.sql", "utf8"));
    await db.exec(`INSERT INTO transcript_inventory_runs(source,created_by) VALUES ('fireflies','00000000-0000-0000-0000-000000000001'); SET ROLE authenticated; SET test.module='no';`);
    expect((await db.query("SELECT * FROM transcript_inventory_runs")).rows).toHaveLength(0);
    await db.exec("SET test.module='yes'");
    expect((await db.query("SELECT * FROM transcript_inventory_runs")).rows).toHaveLength(1);
    await expect(db.exec("UPDATE transcript_inventory_runs SET status='complete'")).rejects.toThrow("permission denied");
    await expect(db.exec("INSERT INTO transcript_repair_logs(run_id,external_id,created_by,status) SELECT id,'x',created_by,'success' FROM transcript_inventory_runs")).rejects.toThrow("permission denied");
    await db.close();
  });
});