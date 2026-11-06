import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFunctionSql } from "./helpers/db";

/**
 * Contenus sociaux : la migration est jouée telle quelle, deux fois, sur
 * PGlite. Les droits passent par les vraies fonctions is_admin et
 * has_module_access, chargées depuis leurs migrations.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION = path.resolve(here, "../migrations/20261105120000_social_contents.sql");
const DATE_MIGRATION = path.resolve(here, "../migrations/20261105130000_social_group_date.sql");
const MEDIA_MIGRATION = path.resolve(here, "../migrations/20261106100000_social_post_media.sql");
const UPDATED_AT_MIGRATION = path.resolve(here, "../migrations/20260108203546_738a153d-fdf5-43d3-a2c6-75e98647a71f.sql");

/** update_updated_at_column, telle que livrée (forme `$$ LANGUAGE ...;` hors du motif de readFunctionSql). */
function readUpdatedAtFunction(): string {
  const match = fs.readFileSync(UPDATED_AT_MIGRATION, "utf8")
    .match(/CREATE OR REPLACE FUNCTION public\.update_updated_at_column\(\)[\s\S]*?\$\$ LANGUAGE plpgsql[^;]*;/);
  if (!match) throw new Error("update_updated_at_column introuvable");
  return match[0];
}

const ADMIN = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const EMMA = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const OTHER = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const MEDIA_A = "a0000000-0000-0000-0000-00000000000a";
const MEDIA_B = "b0000000-0000-0000-0000-00000000000b";

let db: PGlite;
let channels: string[];

beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $stub$
      SELECT NULLIF(current_setting('test.uid', true), '')::uuid
    $stub$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated;
    CREATE TYPE public.app_module AS ENUM ('supertilt_fr', 'crm');
    CREATE TABLE public.profiles (user_id uuid PRIMARY KEY, email text, is_admin boolean NOT NULL DEFAULT false);
    CREATE TABLE public.user_module_access (user_id uuid NOT NULL, module public.app_module NOT NULL);
    CREATE TABLE public.media (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), file_name text NOT NULL);
  `);
  await db.exec(readFunctionSql("20260220170000_add_email_settings.sql", "is_admin"));
  await db.exec(readFunctionSql("20261103100000_supertilt_fr_module.sql", "has_module_access"));
  await db.exec(readUpdatedAtFunction());
  const migration = fs.readFileSync(MIGRATION, "utf8");
  const dateMigration = fs.readFileSync(DATE_MIGRATION, "utf8");
  const mediaMigration = fs.readFileSync(MEDIA_MIGRATION, "utf8");
  for (let i = 0; i < 2; i++) {
    await db.exec(migration);
    await db.exec(dateMigration);
    await db.exec(mediaMigration);
  }
  await db.exec(`
    GRANT ALL ON public.social_channels, public.social_content_groups, public.social_posts TO anon, authenticated;
    GRANT SELECT ON public.media TO authenticated;
    INSERT INTO auth.users VALUES
      ('${ADMIN}', 'admin@exemple.fr'), ('${EMMA}', 'emmanuelle@exemple.fr'), ('${OTHER}', 'autre@exemple.fr');
    INSERT INTO public.profiles VALUES ('${ADMIN}', 'admin@exemple.fr', true);
    INSERT INTO public.user_module_access VALUES ('${EMMA}', 'supertilt_fr'), ('${OTHER}', 'crm');
    INSERT INTO public.media (id, file_name) VALUES ('${MEDIA_A}', 'a.png'), ('${MEDIA_B}', 'b.png');
  `);
  channels = (await db.query<{ id: string }>("SELECT id FROM social_channels ORDER BY sort_order")).rows.map((r) => r.id);
}, 60_000);
afterAll(async () => { await db?.close(); });

beforeEach(async () => {
  await db.exec("RESET ROLE; DELETE FROM social_content_groups;");
});

async function actAs(uid: string | null) {
  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('test.uid', $1, false)", [uid ?? ""]);
  await db.exec(uid ? "SET ROLE authenticated" : "SET ROLE anon");
}

type PostInput = { channel_id: string; text: string; scheduled_at: string | null; media_id?: string | null };

async function save(groupId: string, posts: PostInput[], opts: { format?: string; sync?: boolean } = {}) {
  await db.query("SELECT public.save_social_content_group($1, $2, $3, $4::jsonb)", [
    groupId, opts.format ?? "post", opts.sync ?? true, JSON.stringify(posts),
  ]);
}

async function posts(groupId: string) {
  return (await db.query<{ channel_id: string; text: string; publication_status: string; scheduled_at: Date | null }>(
    "SELECT channel_id, text, publication_status, scheduled_at FROM social_posts WHERE group_id = $1", [groupId],
  )).rows;
}

const GROUP = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const three = (text: string, scheduled_at: string | null = null) =>
  channels.slice(0, 3).map((channel_id) => ({ channel_id, text, scheduled_at }));

describe("Canaux", () => {
  it("compte exactement 8 canaux après deux rejeux de la migration", async () => {
    const res = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM social_channels");
    expect(res.rows[0].n).toBe(8);
  });
});

describe("save_social_content_group", () => {
  it("crée un groupe et trois posts liés, sans date", async () => {
    await actAs(EMMA);
    await save(GROUP, three("Bonjour"));
    const groups = await db.query<{ format: string; sync: boolean; created_by: string }>("SELECT format, sync, created_by FROM social_content_groups");
    expect(groups.rows).toEqual([{ format: "post", sync: true, created_by: EMMA }]);
    const rows = await posts(GROUP);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.text === "Bonjour" && r.publication_status === "unscheduled" && r.scheduled_at === null)).toBe(true);
  });

  it("réécrit le même groupe à chaque sauvegarde et retire les canaux décochés", async () => {
    await actAs(EMMA);
    await save(GROUP, three("v1"));
    await save(GROUP, three("v2").slice(0, 2));
    const count = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM social_content_groups");
    expect(count.rows[0].n).toBe(1);
    const rows = await posts(GROUP);
    expect(rows.map((r) => r.text)).toEqual(["v2", "v2"]);
  });

  it("passe en programmé quand une date est posée", async () => {
    await actAs(EMMA);
    await save(GROUP, three("Daté", "2026-11-20T08:30:00Z"));
    const rows = await posts(GROUP);
    expect(rows.every((r) => r.publication_status === "scheduled")).toBe(true);
    expect(rows[0].scheduled_at?.toISOString()).toBe("2026-11-20T08:30:00.000Z");
  });

  it("refuse un groupe sans canal et ne crée rien", async () => {
    await actAs(EMMA);
    await expect(save(GROUP, [])).rejects.toThrow("Choisissez au moins un canal");
    await db.exec("RESET ROLE");
    const count = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM social_content_groups");
    expect(count.rows[0].n).toBe(0);
  });

  it("réécrit un groupe existant avec une synchro coupée, un autre format et des textes propres", async () => {
    await actAs(EMMA);
    await save(GROUP, three("Commun"));
    const own = channels.slice(0, 3).map((channel_id, i) => ({ channel_id, text: `propre ${i}`, scheduled_at: null }));
    await save(GROUP, own, { sync: false, format: "story" });
    const g = await db.query<{ sync: boolean; format: string }>("SELECT sync, format FROM social_content_groups WHERE id = $1", [GROUP]);
    expect(g.rows).toEqual([{ sync: false, format: "story" }]);
    const byChannel = Object.fromEntries((await posts(GROUP)).map((r) => [r.channel_id, r.text]));
    expect(byChannel).toEqual({ [channels[0]]: "propre 0", [channels[1]]: "propre 1", [channels[2]]: "propre 2" });
  });

  it("ne réécrit ni ne supprime une déclinaison publiée", async () => {
    await actAs(EMMA);
    await save(GROUP, three("Publié"));
    await db.query("UPDATE social_posts SET publication_status = 'published' WHERE group_id = $1 AND channel_id = $2", [GROUP, channels[0]]);
    await save(GROUP, three("Nouveau", "2026-11-20T08:30:00Z"));
    let published = (await posts(GROUP)).find((r) => r.channel_id === channels[0]);
    expect(published).toMatchObject({ text: "Publié", scheduled_at: null, publication_status: "published" });
    await save(GROUP, three("Encore").slice(1));
    published = (await posts(GROUP)).find((r) => r.channel_id === channels[0]);
    expect(published).toMatchObject({ text: "Publié", scheduled_at: null, publication_status: "published" });
  });

  it("refuse un format hors post, story, reel", async () => {
    await actAs(EMMA);
    await expect(save(GROUP, three("x"), { format: "carousel" })).rejects.toThrow(/check constraint/);
    await save(GROUP, three("x"), { format: "reel" });
    const g = await db.query<{ format: string }>("SELECT format FROM social_content_groups");
    expect(g.rows[0].format).toBe("reel");
  });
});

describe("set_social_group_date", () => {
  const setDate = (groupId: string, at: string | null) =>
    db.query<{ n: number }>("SELECT public.set_social_group_date($1, $2::timestamptz) AS n", [groupId, at]);

  it("date toutes les déclinaisons du groupe et les passe en programmé", async () => {
    await actAs(EMMA);
    await save(GROUP, three("Brouillon"));
    const res = await setDate(GROUP, "2026-11-12T08:00:00Z");
    expect(res.rows[0].n).toBe(3);
    const rows = await posts(GROUP);
    expect(rows.every((r) => r.publication_status === "scheduled" && r.scheduled_at?.toISOString() === "2026-11-12T08:00:00.000Z")).toBe(true);
  });

  it("laisse intacte une déclinaison publiée", async () => {
    await actAs(EMMA);
    await save(GROUP, three("Mixte", "2026-11-03T17:00:00Z"));
    await db.query("UPDATE social_posts SET publication_status = 'published' WHERE group_id = $1 AND channel_id = $2", [GROUP, channels[0]]);
    const res = await setDate(GROUP, "2026-11-10T17:00:00Z");
    expect(res.rows[0].n).toBe(2);
    const byChannel = Object.fromEntries((await posts(GROUP)).map((r) => [r.channel_id, [r.publication_status, r.scheduled_at?.toISOString()]]));
    expect(byChannel).toEqual({
      [channels[0]]: ["published", "2026-11-03T17:00:00.000Z"],
      [channels[1]]: ["scheduled", "2026-11-10T17:00:00.000Z"],
      [channels[2]]: ["scheduled", "2026-11-10T17:00:00.000Z"],
    });
  });

  it("retire la date avec null et repasse en sans date", async () => {
    await actAs(EMMA);
    await save(GROUP, three("Daté", "2026-11-20T08:30:00Z"));
    await setDate(GROUP, null);
    const rows = await posts(GROUP);
    expect(rows.every((r) => r.publication_status === "unscheduled" && r.scheduled_at === null)).toBe(true);
  });

  it("refuse un compte sans droit et anon, sans rien modifier", async () => {
    await actAs(EMMA);
    await save(GROUP, three("Privé"));
    await actAs(OTHER);
    await expect(setDate(GROUP, "2026-11-12T08:00:00Z")).rejects.toThrow("Contenu introuvable");
    await actAs(null);
    await expect(setDate(GROUP, "2026-11-12T08:00:00Z")).rejects.toThrow(/permission denied/);
    await db.exec("RESET ROLE");
    expect((await posts(GROUP)).every((r) => r.publication_status === "unscheduled" && r.scheduled_at === null)).toBe(true);
  });
});

describe("social_posts_propagate_text", () => {
  it("recopie le texte modifié vers les autres posts d'un groupe synchronisé", async () => {
    await actAs(EMMA);
    await save(GROUP, three("Avant"));
    await db.query("UPDATE social_posts SET text = 'Après' WHERE group_id = $1 AND channel_id = $2", [GROUP, channels[0]]);
    expect((await posts(GROUP)).map((r) => r.text)).toEqual(["Après", "Après", "Après"]);
  });

  it("ne touche que la déclinaison modifiée quand la synchro est coupée", async () => {
    await actAs(EMMA);
    await save(GROUP, three("Commun"), { sync: false });
    await db.query("UPDATE social_posts SET text = 'Propre' WHERE group_id = $1 AND channel_id = $2", [GROUP, channels[1]]);
    const byChannel = Object.fromEntries((await posts(GROUP)).map((r) => [r.channel_id, r.text]));
    expect(byChannel).toEqual({ [channels[0]]: "Commun", [channels[1]]: "Propre", [channels[2]]: "Commun" });
  });

  it("garde des textes distincts enregistrés avec la synchro coupée", async () => {
    await actAs(EMMA);
    await save(GROUP, channels.slice(0, 2).map((channel_id, i) => ({ channel_id, text: `t${i}`, scheduled_at: null })), { sync: false });
    expect((await posts(GROUP)).map((r) => r.text).sort()).toEqual(["t0", "t1"]);
  });

  it("ne réécrit pas une déclinaison publiée", async () => {
    await actAs(EMMA);
    await save(GROUP, three("Avant"));
    await db.query("UPDATE social_posts SET publication_status = 'published' WHERE group_id = $1 AND channel_id = $2", [GROUP, channels[2]]);
    await db.query("UPDATE social_posts SET text = 'Après' WHERE group_id = $1 AND channel_id = $2", [GROUP, channels[0]]);
    const byChannel = Object.fromEntries((await posts(GROUP)).map((r) => [r.channel_id, r.text]));
    expect(byChannel).toEqual({ [channels[0]]: "Après", [channels[1]]: "Après", [channels[2]]: "Avant" });
  });

  it("ne propage pas une modification faite sur une déclinaison publiée", async () => {
    await actAs(EMMA);
    await save(GROUP, three("Avant"));
    await db.query("UPDATE social_posts SET publication_status = 'published' WHERE group_id = $1 AND channel_id = $2", [GROUP, channels[0]]);
    await db.query("UPDATE social_posts SET text = 'Corrigé' WHERE group_id = $1 AND channel_id = $2", [GROUP, channels[0]]);
    const byChannel = Object.fromEntries((await posts(GROUP)).map((r) => [r.channel_id, r.text]));
    expect(byChannel).toEqual({ [channels[0]]: "Corrigé", [channels[1]]: "Avant", [channels[2]]: "Avant" });
  });
});

describe("Visuel des déclinaisons", () => {
  async function media(groupId: string) {
    return Object.fromEntries((await db.query<{ channel_id: string; media_id: string | null }>(
      "SELECT channel_id, media_id FROM social_posts WHERE group_id = $1", [groupId],
    )).rows.map((r) => [r.channel_id, r.media_id]));
  }
  const withMedia = (media_id: string | null) => three("Texte").map((p) => ({ ...p, media_id }));

  it("enregistre le visuel de chaque post par la RPC", async () => {
    await actAs(EMMA);
    await save(GROUP, withMedia(MEDIA_A));
    expect(Object.values(await media(GROUP))).toEqual([MEDIA_A, MEDIA_A, MEDIA_A]);
    await save(GROUP, withMedia(null));
    expect(Object.values(await media(GROUP))).toEqual([null, null, null]);
  });

  it("recopie le visuel choisi sur une déclinaison vers tout le groupe synchronisé", async () => {
    await actAs(EMMA);
    await save(GROUP, three("Texte"));
    await db.query("UPDATE social_posts SET media_id = $1 WHERE group_id = $2 AND channel_id = $3", [MEDIA_A, GROUP, channels[1]]);
    expect(await media(GROUP)).toEqual({ [channels[0]]: MEDIA_A, [channels[1]]: MEDIA_A, [channels[2]]: MEDIA_A });
  });

  it("garde un visuel par déclinaison quand la synchro est coupée", async () => {
    await actAs(EMMA);
    const own = channels.slice(0, 3).map((channel_id, i) => ({
      channel_id, text: "Texte", scheduled_at: null, media_id: [MEDIA_A, MEDIA_B, null][i],
    }));
    await save(GROUP, own, { sync: false });
    expect(await media(GROUP)).toEqual({ [channels[0]]: MEDIA_A, [channels[1]]: MEDIA_B, [channels[2]]: null });
    await db.query("UPDATE social_posts SET media_id = $1 WHERE group_id = $2 AND channel_id = $3", [MEDIA_A, GROUP, channels[2]]);
    expect(await media(GROUP)).toEqual({ [channels[0]]: MEDIA_A, [channels[1]]: MEDIA_B, [channels[2]]: MEDIA_A });
  });

  it("ne réécrit pas le visuel d'une déclinaison publiée", async () => {
    await actAs(EMMA);
    await save(GROUP, withMedia(MEDIA_A));
    await db.query("UPDATE social_posts SET publication_status = 'published' WHERE group_id = $1 AND channel_id = $2", [GROUP, channels[0]]);
    await db.query("UPDATE social_posts SET media_id = $1 WHERE group_id = $2 AND channel_id = $3", [MEDIA_B, GROUP, channels[1]]);
    expect(await media(GROUP)).toEqual({ [channels[0]]: MEDIA_A, [channels[1]]: MEDIA_B, [channels[2]]: MEDIA_B });
    await save(GROUP, withMedia(null));
    expect(await media(GROUP)).toEqual({ [channels[0]]: MEDIA_A, [channels[1]]: null, [channels[2]]: null });
  });

  it("conserve le visuel existant quand la clé media_id est absente, null à la création", async () => {
    await actAs(EMMA);
    await save(GROUP, withMedia(MEDIA_A));
    // Synchro coupée : la propagation ne doit pas masquer le cas « null à la création ».
    await save(GROUP, [...three("Sans clé"), { channel_id: channels[3], text: "Nouveau", scheduled_at: null }], { sync: false });
    expect(await media(GROUP)).toEqual({
      [channels[0]]: MEDIA_A, [channels[1]]: MEDIA_A, [channels[2]]: MEDIA_A, [channels[3]]: null,
    });
  });

  it("ramène à null un media_id inconnu de la Médiathèque, sans erreur", async () => {
    await actAs(EMMA);
    await save(GROUP, withMedia("99999999-9999-9999-9999-999999999999"));
    expect(Object.values(await media(GROUP))).toEqual([null, null, null]);
  });

  it("ne propage pas le changement de visuel d'une déclinaison publiée", async () => {
    await actAs(EMMA);
    await save(GROUP, withMedia(MEDIA_A));
    await db.query("UPDATE social_posts SET publication_status = 'published' WHERE group_id = $1 AND channel_id = $2", [GROUP, channels[0]]);
    await db.query("UPDATE social_posts SET media_id = $1 WHERE group_id = $2 AND channel_id = $3", [MEDIA_B, GROUP, channels[0]]);
    expect(await media(GROUP)).toEqual({ [channels[0]]: MEDIA_B, [channels[1]]: MEDIA_A, [channels[2]]: MEDIA_A });
  });

  it("remet le visuel à null quand le média est supprimé de la Médiathèque", async () => {
    await actAs(EMMA);
    await save(GROUP, withMedia(MEDIA_B));
    await db.exec("RESET ROLE");
    await db.query("DELETE FROM public.media WHERE id = $1", [MEDIA_B]);
    expect(Object.values(await media(GROUP))).toEqual([null, null, null]);
    await db.query("INSERT INTO public.media (id, file_name) VALUES ($1, 'b.png')", [MEDIA_B]);
  });
});

describe("RLS", () => {
  it("un compte sans supertilt_fr ne lit ni n'écrit rien", async () => {
    await actAs(EMMA);
    await save(GROUP, three("Privé"));
    await actAs(OTHER);
    for (const table of ["social_channels", "social_content_groups", "social_posts"]) {
      expect((await db.query(`SELECT * FROM ${table}`)).rows).toHaveLength(0);
    }
    await expect(save("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", three("Intrus"))).rejects.toThrow(/row-level security/);
    await db.query("UPDATE social_posts SET text = 'Intrus'");
    await db.exec("RESET ROLE");
    expect((await posts(GROUP)).every((r) => r.text === "Privé")).toBe(true);
  });

  it("un compte du module, hors admin, lit les canaux sans pouvoir les modifier", async () => {
    await actAs(EMMA);
    expect((await db.query("SELECT * FROM social_channels")).rows).toHaveLength(8);
    const updated = await db.query("UPDATE social_channels SET name = 'Piraté' WHERE slug = 'blog'");
    expect(updated.affectedRows).toBe(0);
    await expect(db.query("INSERT INTO social_channels (slug, name, abbreviation) VALUES ('x', 'X', 'X')")).rejects.toThrow(/row-level security/);
    await db.exec("RESET ROLE");
    const blog = await db.query<{ name: string }>("SELECT name FROM social_channels WHERE slug = 'blog'");
    expect(blog.rows[0].name).toBe("Blog");
  });

  it("anon ne peut ni lire ni appeler la fonction d'enregistrement", async () => {
    await actAs(EMMA);
    await save(GROUP, three("Privé"));
    await actAs(null);
    expect((await db.query("SELECT * FROM social_posts")).rows).toHaveLength(0);
    await expect(save("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", three("Intrus"))).rejects.toThrow(/permission denied/);
  });

  it("un admin sans ligne de droit lit et écrit", async () => {
    await actAs(ADMIN);
    await save(GROUP, three("Admin"));
    expect((await db.query("SELECT * FROM social_channels")).rows).toHaveLength(8);
    expect(await posts(GROUP)).toHaveLength(3);
  });
});
