import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let db: PGlite;
describe("annuaire des assignés projets", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
      CREATE FUNCTION public.is_staff_user() RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.staff',true)='yes' $$;
      CREATE TABLE public.profiles(user_id uuid,display_name text,first_name text,last_name text,email text,is_admin boolean);
      CREATE TABLE public.user_module_access(user_id uuid);
      INSERT INTO profiles VALUES
      ('00000000-0000-0000-0000-000000000001','Romain Couturier','Romain','Couturier','romain@supertilt.fr',true),
      ('00000000-0000-0000-0000-000000000002',null,'Emmanuelle','Marceau','emmanuelle@supertilt.fr',false),
      ('00000000-0000-0000-0000-000000000003','Apprenant',null,null,'learner@example.invalid',false);
      INSERT INTO user_module_access VALUES ('00000000-0000-0000-0000-000000000002');
    `);
    await db.exec(readFileSync("drizzle/migrations/0064_project_assignees_directory.sql", "utf8"));
  });
  afterAll(async () => { await db.close(); });
  it("retourne uniquement le staff avec toutes les valeurs canoniques", async () => {
    await db.exec("SET test.staff='yes'; SET ROLE authenticated;");
    const { rows } = await db.query("SELECT * FROM public.get_project_assignees()");
    expect(rows).toEqual([
      { user_id: "00000000-0000-0000-0000-000000000002", display_name: null, first_name: "Emmanuelle", last_name: "Marceau", email: "emmanuelle@supertilt.fr" },
      { user_id: "00000000-0000-0000-0000-000000000001", display_name: "Romain Couturier", first_name: "Romain", last_name: "Couturier", email: "romain@supertilt.fr" },
    ]);
    await db.exec("RESET ROLE;");
  });
  it("ne retourne aucun profil à un apprenant connecté", async () => {
    await db.exec("SET test.staff='no'; SET ROLE authenticated;");
    expect((await db.query("SELECT * FROM public.get_project_assignees()")).rows).toEqual([]);
    await db.exec("RESET ROLE;");
  });
  it("interdit l'annuaire aux visiteurs anonymes", async () => {
    await db.exec("SET test.staff='yes'; SET ROLE anon;");
    await expect(db.query("SELECT * FROM public.get_project_assignees()")).rejects.toThrow("permission denied");
    await db.exec("RESET ROLE;");
  });
});