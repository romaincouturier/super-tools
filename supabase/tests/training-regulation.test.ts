import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeEach, afterEach, describe, it, expect } from "vitest";

const migration = readFileSync(new URL("../../drizzle/migrations/0034_editable_training_regulation.sql", import.meta.url), "utf8");
const admin = "00000000-0000-0000-0000-000000000001";
const oldUrl = "https://example.test/storage/v1/object/public/training-documents/reglement-interieur/old.pdf";
const newUrl = "https://example.test/storage/v1/object/public/training-documents/reglement-interieur/new.pdf";
let db: PGlite;
beforeEach(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE FUNCTION public.is_admin(id uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT id = '${admin}'::uuid $$;
    CREATE TABLE public.app_settings(setting_key text UNIQUE,setting_value text,description text,updated_at timestamptz default now());`);
  await db.exec(migration);
  await db.query("select set_config('test.uid',$1,false)", [admin]);
  await db.query("insert into app_settings(setting_key,setting_value) values ('reglement_interieur_url',$1)", [oldUrl]);
});
afterEach(async () => { await db.close(); });
const save = (content: string, expected = "") => db.query("select save_training_regulation_draft($1,$2)", [content, expected]);
const publish = (content: string, url = newUrl, expected = oldUrl) => db.query("select publish_training_regulation($1,$2,$3)", [content, url, expected]);
const value = async (key: string) => (await db.query<{ setting_value: string }>("select setting_value from app_settings where setting_key=$1", [key])).rows[0]?.setting_value;

describe("Règlement intérieur", () => {
  it("le brouillon n'altère jamais le PDF publié", async () => {
    await save("Nouveau règlement");
    expect(await value("reglement_interieur_draft")).toBe("Nouveau règlement");
    expect(await value("reglement_interieur_url")).toBe(oldUrl);
  });
  it("publie le PDF et archive le précédent avec le texte et la date", async () => {
    await save("Article modifié"); await publish("Article modifié");
    expect(await value("reglement_interieur_url")).toBe(newUrl);
    const history = JSON.parse(await value("reglement_interieur_versions") || "[]");
    expect(history).toHaveLength(2);
    expect(history[0].url).toBe(oldUrl);
    expect(history[1]).toMatchObject({ url: newUrl, content: "Article modifié", published_by: admin });
    expect(new Date(history[1].published_at).getTime()).toBeGreaterThan(0);
    await save("Version suivante", "Article modifié");
    await publish("Version suivante", newUrl.replace("new.pdf", "next.pdf"), newUrl);
    expect(JSON.parse(await value("reglement_interieur_versions") || "[]")).toHaveLength(3);
  });
  it("refuse les apprenants pour édition et publication", async () => {
    await db.query("select set_config('test.uid',$1,false)", ["00000000-0000-0000-0000-000000000002"]);
    await expect(save("Interdit")).rejects.toThrow("Accès refusé");
    await expect(publish("Interdit")).rejects.toThrow("Accès refusé");
    expect(await value("reglement_interieur_draft")).toBeUndefined();
    expect(await value("reglement_interieur_url")).toBe(oldUrl);
  });
  it("refuse les accès anonymes", async () => {
    await db.query("select set_config('test.uid','',false)");
    await expect(save("Interdit")).rejects.toThrow("Accès refusé");
    await expect(publish("Interdit")).rejects.toThrow("Accès refusé");
  });
  it("empêche l'écrasement d'un brouillon concurrent", async () => {
    await save("Modification A");
    await expect(save("Modification B")).rejects.toThrow("modifié ailleurs");
    expect(await value("reglement_interieur_draft")).toBe("Modification A");
  });
  it("empêche la publication d'une version obsolète", async () => {
    await save("Texte"); await publish("Texte");
    await expect(publish("Texte")).rejects.toThrow("nouvelle version");
    expect(JSON.parse(await value("reglement_interieur_versions") || "[]")).toHaveLength(2);
  });
  it("refuse de publier un texte non sauvegardé", async () => {
    await save("Texte A");
    await expect(publish("Texte B")).rejects.toThrow("Enregistrez le brouillon");
    expect(await value("reglement_interieur_url")).toBe(oldUrl);
    expect(await value("reglement_interieur_versions")).toBeUndefined();
  });
  it("refuse un règlement vide", async () => {
    await save("  ");
    await expect(publish("  ")).rejects.toThrow("vide");
  });
  it("refuse un fichier hors du dossier règlement", async () => {
    await save("Texte");
    await expect(publish("Texte", "https://example.test/fichier.html")).rejects.toThrow("URL PDF invalide");
    expect(await value("reglement_interieur_url")).toBe(oldUrl);
  });
});