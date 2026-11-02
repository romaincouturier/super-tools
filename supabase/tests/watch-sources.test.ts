import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import { normalizeWatchSourceUrl, sortWatchSources, WATCH_EXPERTS, type WatchSource } from "../../src/lib/watchSources";

let db: PGlite;
beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE FUNCTION public.is_staff_user() RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.staff',true)='yes' $$;
    CREATE TABLE public.watch_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid());`);
  await db.exec(fs.readFileSync("drizzle/migrations/0015_watch_source_registry.sql", "utf8"));
});
afterAll(async () => { await db?.close(); });

async function add(url: string) {
  return (await db.query<{ id: string; status: string; url: string }>(`INSERT INTO watch_sources(expert,name,type,language,url) VALUES ('strategie','Source','blog','fr',$1) RETURNING id,status,url`, [url])).rows[0];
}

describe("Registre des sources", () => {
  it("normalise en minuscules sans utm ni slash final, conserve les autres paramètres", async () => {
    const url = " HTTPS://EXAMPLE.COM/Blog/?utm_source=Mail&topic=SEO&utm_medium=email#intro ";
    const normalized = "https://example.com/blog?topic=seo";
    expect(normalizeWatchSourceUrl(url)).toBe(normalized);
    const result = await db.query<{ url: string }>("SELECT normalize_watch_source_url($1) AS url", [url]);
    expect(result.rows[0].url).toBe(normalized);
  });
  it("empêche les doublons d’URL même sur des écritures concurrentes", async () => {
    await add("https://duplicate.example/Source/?utm_source=first");
    await expect(add("HTTPS://DUPLICATE.EXAMPLE/source")).rejects.toThrow(/unique/);
  });
  it("crée les sources en proposed", async () => {
    expect((await add("https://default.example")).status).toBe("proposed");
  });
  it("accepte les onze experts stables et refuse un identifiant inconnu", async () => {
    expect(Object.keys(WATCH_EXPERTS)).toHaveLength(11);
    for (const expert of Object.keys(WATCH_EXPERTS)) {
      await db.query(`INSERT INTO watch_sources(expert,name,type,language,url) VALUES ($1,'Expert','site','fr',$2)`, [expert, `https://${expert}.example`]);
    }
    await expect(db.exec(`UPDATE watch_sources SET expert='unknown'`)).rejects.toThrow(/check constraint/);
  });
  it("utilité optionnelle limitée à 1–5", async () => {
    const source = await add("https://rating.example");
    for (const rating of [null, 1, 5]) await db.query("UPDATE watch_sources SET usefulness=$1 WHERE id=$2", [rating, source.id]);
    for (const rating of [0, 6]) await expect(db.query("UPDATE watch_sources SET usefulness=$1 WHERE id=$2", [rating, source.id])).rejects.toThrow(/check constraint/);
  });
  it("compte les fiches rattachées une fois et ajuste au changement ou retrait", async () => {
    const first = await add("https://count-one.example");
    const second = await add("https://count-two.example");
    const item = (await db.query<{id: string}>("INSERT INTO watch_items(source_id) VALUES ($1) RETURNING id", [first.id])).rows[0];
    const count = async (id: string) => (await db.query<{items_count: number}>("SELECT items_count FROM watch_sources WHERE id=$1", [id])).rows[0].items_count;
    expect(await count(first.id)).toBe(1);
    await db.query("UPDATE watch_items SET source_id=$1 WHERE id=$2", [first.id, item.id]);
    expect(await count(first.id)).toBe(1);
    await db.query("UPDATE watch_items SET source_id=$1 WHERE id=$2", [second.id, item.id]);
    expect(await count(first.id)).toBe(0);
    expect(await count(second.id)).toBe(1);
    await db.query("DELETE FROM watch_items WHERE id=$1", [item.id]);
    expect(await count(second.id)).toBe(0);
  });
  it("refuse les écritures et lectures non staff, conserve les accès staff", async () => {
    await db.exec("SET ROLE authenticated; SELECT set_config('test.staff','no',false)");
    expect((await db.query("SELECT * FROM watch_sources")).rows).toHaveLength(0);
    await expect(add("https://nonstaff.example")).rejects.toThrow(/row-level security/);
    await db.exec("SELECT set_config('test.staff','yes',false)");
    expect((await add("https://staff.example")).status).toBe("proposed");
    expect((await db.query("SELECT * FROM watch_sources")).rows.length).toBeGreaterThan(0);
    await db.exec("RESET ROLE");
  });
  it("place les propositions avant les autres statuts", () => {
    const rows = ["followed", "dropped", "proposed", "to_subscribe"].map((status, index) => ({ status, id: String(index), created_at: "2026-10-27" } as WatchSource));
    expect(sortWatchSources(rows).map((s) => s.status)).toEqual(["proposed", "to_subscribe", "followed", "dropped"]);
  });
});