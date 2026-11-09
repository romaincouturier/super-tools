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
const THEMES_MIGRATION = path.resolve(here, "../migrations/20261106110000_social_themes.sql");
const PUBLICATION_MIGRATION = path.resolve(here, "../migrations/20261107100000_social_post_publication.sql");
const NOTES_MIGRATION = path.resolve(here, "../migrations/20261109100000_social_calendar_notes.sql");
const AUTHORSHIP_MIGRATION = path.resolve(here, "../migrations/20261110100000_social_authorship_and_note_colors.sql");
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
/** Thèmes présents juste après la double application des migrations, avant tout nettoyage. */
let themesAfterMigration: number;

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
  const themesMigration = fs.readFileSync(THEMES_MIGRATION, "utf8");
  const publicationMigration = fs.readFileSync(PUBLICATION_MIGRATION, "utf8");
  const notesMigration = fs.readFileSync(NOTES_MIGRATION, "utf8");
  const authorshipMigration = fs.readFileSync(AUTHORSHIP_MIGRATION, "utf8");
  for (let i = 0; i < 2; i++) {
    await db.exec(migration);
    await db.exec(dateMigration);
    await db.exec(mediaMigration);
    await db.exec(themesMigration);
    await db.exec(publicationMigration);
    await db.exec(notesMigration);
    await db.exec(authorshipMigration);
  }
  await db.exec(`
    GRANT ALL ON public.social_channels, public.social_content_groups, public.social_posts, public.social_themes, public.social_calendar_notes TO anon, authenticated;
    GRANT SELECT ON public.media TO authenticated;
    INSERT INTO auth.users VALUES
      ('${ADMIN}', 'admin@exemple.fr'), ('${EMMA}', 'emmanuelle@exemple.fr'), ('${OTHER}', 'autre@exemple.fr');
    INSERT INTO public.profiles VALUES ('${ADMIN}', 'admin@exemple.fr', true);
    INSERT INTO public.user_module_access VALUES ('${EMMA}', 'supertilt_fr'), ('${OTHER}', 'crm');
    INSERT INTO public.media (id, file_name) VALUES ('${MEDIA_A}', 'a.png'), ('${MEDIA_B}', 'b.png');
  `);
  channels = (await db.query<{ id: string }>("SELECT id FROM social_channels ORDER BY sort_order")).rows.map((r) => r.id);
  themesAfterMigration = (await db.query<{ n: number }>("SELECT count(*)::int AS n FROM social_themes")).rows[0].n;
}, 60_000);
afterAll(async () => { await db?.close(); });

beforeEach(async () => {
  await db.exec("RESET ROLE; RESET TIME ZONE; DELETE FROM social_content_groups; DELETE FROM social_themes; DELETE FROM social_calendar_notes;");
});

async function actAs(uid: string | null) {
  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('test.uid', $1, false)", [uid ?? ""]);
  await db.exec(uid ? "SET ROLE authenticated" : "SET ROLE anon");
}

type PostInput = { channel_id: string; text: string; scheduled_at: string | null; media_id?: string | null };

async function save(groupId: string, posts: PostInput[], opts: { format?: string; sync?: boolean; themeId?: string | null } = {}) {
  if (opts.themeId === undefined) {
    await db.query("SELECT public.save_social_content_group($1, $2, $3, $4::jsonb)", [
      groupId, opts.format ?? "post", opts.sync ?? true, JSON.stringify(posts),
    ]);
    return;
  }
  await db.query("SELECT public.save_social_content_group($1, $2, $3, $4::jsonb, $5)", [
    groupId, opts.format ?? "post", opts.sync ?? true, JSON.stringify(posts), opts.themeId,
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

describe("Thèmes", () => {
  const THEME_A = "1a000000-0000-0000-0000-00000000001a";
  const THEME_B = "1b000000-0000-0000-0000-00000000001b";
  const GROUPS = ["d1000000-0000-0000-0000-0000000000d1", "d2000000-0000-0000-0000-0000000000d2", "d3000000-0000-0000-0000-0000000000d3"];
  const insertTheme = (id: string, name: string, color = "#3b82f6") =>
    db.query("INSERT INTO social_themes (id, name, color) VALUES ($1, $2, $3)", [id, name, color]);
  const themeOf = async (groupId: string) =>
    (await db.query<{ theme_id: string | null }>("SELECT theme_id FROM social_content_groups WHERE id = $1", [groupId])).rows[0]?.theme_id;

  it("1.4-SQL-002 : aucun thème après deux rejeux de la migration", () => {
    expect(themesAfterMigration).toBe(0);
  });

  it("refuse un nom en double, insensible à la casse et aux espaces", async () => {
    await actAs(EMMA);
    await insertTheme(THEME_A, "IA");
    await expect(insertTheme(THEME_B, " ia ")).rejects.toThrow(/duplicate key|social_themes_name_key/);
    await db.exec("RESET ROLE");
    expect((await db.query("SELECT * FROM social_themes")).rows).toHaveLength(1);
  });

  it("refuse un nom fait uniquement de blancs (espace, tabulation, retour ligne, espace insécable)", async () => {
    await actAs(EMMA);
    for (const blank of ["", "   ", "\t", " \t\n ", "\u00a0", " \u00a0\t", "\u202f\u3000"]) {
      await expect(insertTheme(THEME_A, blank)).rejects.toThrow(/social_themes_name_not_blank/);
    }
    await db.exec("RESET ROLE");
    expect((await db.query("SELECT * FROM social_themes")).rows).toHaveLength(0);
  });

  it("l'unicité ignore aussi les blancs Unicode de bord", async () => {
    await actAs(EMMA);
    await insertTheme(THEME_A, "IA");
    await expect(insertTheme(THEME_B, "\u00a0ia\t")).rejects.toThrow(/duplicate key|social_themes_name_key/);
    await insertTheme(THEME_B, "I A");
    await db.exec("RESET ROLE");
    expect((await db.query("SELECT * FROM social_themes")).rows).toHaveLength(2);
  });

  it("refuse une couleur hors #rrggbb", async () => {
    await actAs(EMMA);
    await expect(insertTheme(THEME_A, "IA", "#FFF")).rejects.toThrow(/check constraint/);
    await expect(insertTheme(THEME_A, "IA", "#3B82F6")).rejects.toThrow(/check constraint/);
    await expect(insertTheme(THEME_A, "IA", "bleu")).rejects.toThrow(/check constraint/);
  });

  it("enregistre le thème du contenu par la RPC, le change et le retire", async () => {
    await actAs(EMMA);
    await insertTheme(THEME_A, "IA");
    await insertTheme(THEME_B, "Facilitation", "#22c55e");
    await save(GROUP, three("Texte"), { themeId: THEME_A });
    expect(await themeOf(GROUP)).toBe(THEME_A);
    await save(GROUP, three("Texte"), { themeId: THEME_B });
    expect(await themeOf(GROUP)).toBe(THEME_B);
    await save(GROUP, three("Texte"), { themeId: null });
    expect(await themeOf(GROUP)).toBeNull();
  });

  it("ramène à null un thème inconnu, sans erreur", async () => {
    await actAs(EMMA);
    await save(GROUP, three("Texte"), { themeId: "99999999-9999-9999-9999-999999999999" });
    expect(await themeOf(GROUP)).toBeNull();
    expect(await posts(GROUP)).toHaveLength(3);
  });

  it("1.4-SQL-001 : supprimer un thème laisse ses contenus intacts, sans thème", async () => {
    await actAs(EMMA);
    await insertTheme(THEME_A, "IA");
    for (const id of GROUPS) await save(id, three(`Contenu ${id}`), { themeId: THEME_A });
    await db.query("DELETE FROM social_themes WHERE id = $1", [THEME_A]);
    for (const id of GROUPS) {
      expect(await themeOf(id)).toBeNull();
      expect((await posts(id)).map((r) => r.text)).toEqual([`Contenu ${id}`, `Contenu ${id}`, `Contenu ${id}`]);
    }
  });

  it("un compte du module, hors Romain, crée, renomme, recolore et supprime un thème", async () => {
    await actAs(EMMA);
    await insertTheme(THEME_A, "IA");
    expect((await db.query("UPDATE social_themes SET name = 'IA appliquée', color = '#ef4444' WHERE id = $1", [THEME_A])).affectedRows).toBe(1);
    expect((await db.query<{ name: string; color: string }>("SELECT name, color FROM social_themes")).rows)
      .toEqual([{ name: "IA appliquée", color: "#ef4444" }]);
    expect((await db.query("DELETE FROM social_themes WHERE id = $1", [THEME_A])).affectedRows).toBe(1);
  });

  it("un compte sans supertilt_fr ne lit, ne crée, ne modifie ni ne supprime aucun thème", async () => {
    await actAs(EMMA);
    await insertTheme(THEME_A, "IA");
    await actAs(OTHER);
    expect((await db.query("SELECT * FROM social_themes")).rows).toHaveLength(0);
    await expect(insertTheme(THEME_B, "Intrus")).rejects.toThrow(/row-level security/);
    expect((await db.query("UPDATE social_themes SET name = 'Piraté'")).affectedRows).toBe(0);
    expect((await db.query("DELETE FROM social_themes")).affectedRows).toBe(0);
    await db.exec("RESET ROLE");
    expect((await db.query<{ name: string }>("SELECT name FROM social_themes")).rows).toEqual([{ name: "IA" }]);
  });

  it("anon ne lit ni n'écrit aucun thème", async () => {
    await actAs(EMMA);
    await insertTheme(THEME_A, "IA");
    await actAs(null);
    expect((await db.query("SELECT * FROM social_themes")).rows).toHaveLength(0);
    await expect(insertTheme(THEME_B, "Intrus")).rejects.toThrow(/row-level security/);
    expect((await db.query("UPDATE social_themes SET name = 'Piraté'")).affectedRows).toBe(0);
    expect((await db.query("DELETE FROM social_themes")).affectedRows).toBe(0);
    await db.exec("RESET ROLE");
    expect((await db.query("SELECT * FROM social_themes")).rows).toHaveLength(1);
  });

  it("un admin sans ligne de droit gère les thèmes", async () => {
    await actAs(ADMIN);
    await insertTheme(THEME_A, "IA");
    expect((await db.query("UPDATE social_themes SET color = '#8b5cf6' WHERE id = $1", [THEME_A])).affectedRows).toBe(1);
    expect((await db.query("SELECT * FROM social_themes")).rows).toHaveLength(1);
    expect((await db.query("DELETE FROM social_themes WHERE id = $1", [THEME_A])).affectedRows).toBe(1);
  });
});

describe("Marquage publié et suppression (story 1.5)", () => {
  const DATED = "2026-11-20T08:30:00Z";
  const two = (text: string, scheduled_at: string | null = DATED) =>
    channels.slice(0, 2).map((channel_id) => ({ channel_id, text, scheduled_at }));
  const postId = async (groupId: string, channelId: string) =>
    (await db.query<{ id: string }>("SELECT id FROM social_posts WHERE group_id = $1 AND channel_id = $2", [groupId, channelId])).rows[0].id;
  const setPublished = (id: string, published: boolean) =>
    db.query<{ status: string }>("SELECT public.set_social_post_published($1, $2) AS status", [id, published]);
  const updateContent = (id: string, text: string, mediaId: string | null) =>
    db.query("SELECT public.update_social_post_content($1, $2, $3)", [id, text, mediaId]);
  const byChannel = async (groupId: string) =>
    Object.fromEntries((await db.query<{ channel_id: string; text: string; publication_status: string; scheduled_at: Date | null; media_id: string | null }>(
      "SELECT channel_id, text, publication_status, scheduled_at, media_id FROM social_posts WHERE group_id = $1", [groupId],
    )).rows.map((r) => [r.channel_id, r]));
  const groupCount = async () => (await db.query<{ n: number }>("SELECT count(*)::int AS n FROM social_content_groups")).rows[0].n;

  it("1.5-SQL-001 : marquer une déclinaison ne touche qu'elle", async () => {
    await actAs(EMMA);
    await save(GROUP, two("Texte"));
    const res = await setPublished(await postId(GROUP, channels[0]), true);
    expect(res.rows[0].status).toBe("published");
    const rows = await byChannel(GROUP);
    expect(rows[channels[0]].publication_status).toBe("published");
    expect(rows[channels[1]].publication_status).toBe("scheduled");
    await setPublished(await postId(GROUP, channels[1]), true);
    expect(Object.values(await byChannel(GROUP)).every((r) => r.publication_status === "published")).toBe(true);
  });

  it("1.5-SQL-002 : annuler repasse en programmé avec la date conservée", async () => {
    await actAs(EMMA);
    await save(GROUP, two("Texte"));
    const id = await postId(GROUP, channels[0]);
    await setPublished(id, true);
    const res = await setPublished(id, false);
    expect(res.rows[0].status).toBe("scheduled");
    expect((await byChannel(GROUP))[channels[0]]).toMatchObject({ publication_status: "scheduled" });
    expect((await byChannel(GROUP))[channels[0]].scheduled_at?.toISOString()).toBe("2026-11-20T08:30:00.000Z");
  });

  it("1.5-SQL-002 : annuler une ligne publiée sans date la repasse sans date", async () => {
    await actAs(EMMA);
    await save(GROUP, two("Texte", null));
    const id = await postId(GROUP, channels[0]);
    await db.query("UPDATE social_posts SET publication_status = 'published' WHERE id = $1", [id]);
    const res = await setPublished(id, false);
    expect(res.rows[0].status).toBe("unscheduled");
    expect((await byChannel(GROUP))[channels[0]]).toMatchObject({ publication_status: "unscheduled", scheduled_at: null });
  });

  it("refuse de marquer publiée une déclinaison sans date", async () => {
    await actAs(EMMA);
    await save(GROUP, two("Texte", null));
    await expect(setPublished(await postId(GROUP, channels[0]), true)).rejects.toThrow("Planifiez une date pour marquer publié");
    expect(Object.values(await byChannel(GROUP)).every((r) => r.publication_status === "unscheduled")).toBe(true);
  });

  it("1.5-SQL-003 : une déclinaison publiée garde sa date au changement de date du groupe", async () => {
    await actAs(EMMA);
    await save(GROUP, two("Texte"));
    await setPublished(await postId(GROUP, channels[0]), true);
    await db.query("SELECT public.set_social_group_date($1, $2::timestamptz)", [GROUP, "2026-12-01T10:00:00Z"]);
    await save(GROUP, two("Texte", "2026-12-02T10:00:00Z"));
    const rows = await byChannel(GROUP);
    expect(rows[channels[0]].scheduled_at?.toISOString()).toBe("2026-11-20T08:30:00.000Z");
    expect(rows[channels[1]].scheduled_at?.toISOString()).toBe("2026-12-02T10:00:00.000Z");
  });

  it("modifie seule une déclinaison publiée, sans propagation, synchro active", async () => {
    await actAs(EMMA);
    await save(GROUP, two("Commun").map((p) => ({ ...p, media_id: MEDIA_A })));
    const id = await postId(GROUP, channels[0]);
    await setPublished(id, true);
    await updateContent(id, "Corrigé après publication", MEDIA_B);
    const rows = await byChannel(GROUP);
    expect(rows[channels[0]]).toMatchObject({ text: "Corrigé après publication", media_id: MEDIA_B, publication_status: "published" });
    expect(rows[channels[1]]).toMatchObject({ text: "Commun", media_id: MEDIA_A });
  });

  it("ramène à null un visuel inconnu sur une déclinaison publiée", async () => {
    await actAs(EMMA);
    await save(GROUP, two("Texte").map((p) => ({ ...p, media_id: MEDIA_A })));
    const id = await postId(GROUP, channels[0]);
    await setPublished(id, true);
    await updateContent(id, "Texte", "99999999-9999-9999-9999-999999999999");
    expect((await byChannel(GROUP))[channels[0]].media_id).toBeNull();
  });

  it("refuse l'édition seule d'une déclinaison non publiée", async () => {
    await actAs(EMMA);
    await save(GROUP, two("Texte"));
    await expect(updateContent(await postId(GROUP, channels[0]), "Seul", null)).rejects.toThrow("Seule une déclinaison publiée se modifie seule");
    expect(Object.values(await byChannel(GROUP)).every((r) => r.text === "Texte")).toBe(true);
  });

  it("la synchro après marquage change les autres déclinaisons et laisse la publiée intacte", async () => {
    await actAs(EMMA);
    await save(GROUP, two("Avant"));
    await setPublished(await postId(GROUP, channels[0]), true);
    await save(GROUP, two("Après"));
    const rows = await byChannel(GROUP);
    expect(rows[channels[0]].text).toBe("Avant");
    expect(rows[channels[1]].text).toBe("Après");
  });

  it("1.5-SQL-004 : supprimer une déclinaison garde le groupe et les autres", async () => {
    await actAs(EMMA);
    await save(GROUP, three("Texte"));
    await db.query("DELETE FROM social_posts WHERE id = $1", [await postId(GROUP, channels[1])]);
    expect(Object.keys(await byChannel(GROUP)).sort()).toEqual([channels[0], channels[2]].sort());
    expect(await groupCount()).toBe(1);
  });

  it("1.5-SQL-004 : supprimer la dernière déclinaison supprime le groupe (social_posts_delete_empty_group)", async () => {
    await actAs(EMMA);
    await save(GROUP, three("Texte").slice(0, 1));
    await db.query("DELETE FROM social_posts WHERE group_id = $1", [GROUP]);
    expect(await groupCount()).toBe(0);
  });

  it("1.5-SQL-004 : supprimer le contenu supprime toutes ses déclinaisons, publiée comprise", async () => {
    await actAs(EMMA);
    await save(GROUP, three("Texte", DATED));
    await setPublished(await postId(GROUP, channels[0]), true);
    expect((await db.query("DELETE FROM social_content_groups WHERE id = $1", [GROUP])).affectedRows).toBe(1);
    await db.exec("RESET ROLE");
    expect((await db.query("SELECT * FROM social_posts")).rows).toHaveLength(0);
    expect(await groupCount()).toBe(0);
  });

  it("remplacer tous les canaux d'un groupe ne le supprime pas", async () => {
    await actAs(EMMA);
    await save(GROUP, [{ channel_id: channels[0], text: "Texte", scheduled_at: null }]);
    await save(GROUP, [{ channel_id: channels[1], text: "Texte", scheduled_at: null }]);
    expect(await groupCount()).toBe(1);
    expect(Object.keys(await byChannel(GROUP))).toEqual([channels[1]]);
  });

  it("un compte sans droit ne marque, ne modifie ni ne supprime rien", async () => {
    await actAs(EMMA);
    await save(GROUP, two("Privé"));
    const id = await postId(GROUP, channels[0]);
    await setPublished(id, true);
    await actAs(OTHER);
    await expect(setPublished(id, false)).rejects.toThrow("Déclinaison introuvable");
    await expect(updateContent(id, "Intrus", null)).rejects.toThrow("Déclinaison introuvable");
    expect((await db.query("DELETE FROM social_posts")).affectedRows).toBe(0);
    expect((await db.query("DELETE FROM social_content_groups")).affectedRows).toBe(0);
    await db.exec("RESET ROLE");
    const rows = await byChannel(GROUP);
    expect(rows[channels[0]]).toMatchObject({ text: "Privé", publication_status: "published" });
    expect(Object.keys(rows)).toHaveLength(2);
  });

  it("anon ne peut appeler ni le marquage ni l'édition seule", async () => {
    await actAs(EMMA);
    await save(GROUP, two("Privé"));
    const id = await postId(GROUP, channels[0]);
    await actAs(null);
    await expect(setPublished(id, true)).rejects.toThrow(/permission denied/);
    await expect(updateContent(id, "Intrus", null)).rejects.toThrow(/permission denied/);
    await db.exec("RESET ROLE");
    expect((await byChannel(GROUP))[channels[0]]).toMatchObject({ text: "Privé", publication_status: "scheduled" });
  });

  it("un admin sans ligne de droit marque et modifie une déclinaison", async () => {
    await actAs(ADMIN);
    await save(GROUP, two("Admin"));
    const id = await postId(GROUP, channels[0]);
    await setPublished(id, true);
    await updateContent(id, "Admin corrigé", null);
    expect((await byChannel(GROUP))[channels[0]]).toMatchObject({ text: "Admin corrigé", publication_status: "published" });
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

describe("Notes du calendrier (story 1.6)", () => {
  const NOTE = "e1000000-0000-0000-0000-0000000000e1";
  const insertNote = (day: string, text: string, color = "#f97316", id = NOTE) =>
    db.query("INSERT INTO social_calendar_notes (id, day, text, color) VALUES ($1, $2, $3, $4)", [id, day, text, color]);
  const dayOf = async (id = NOTE) =>
    (await db.query<{ day: string }>("SELECT day::text AS day FROM social_calendar_notes WHERE id = $1", [id])).rows[0]?.day;

  it("1.6-SQL-001 : un jour sans heure reste le même jour, quel que soit le fuseau de session", async () => {
    await actAs(EMMA);
    await insertNote("2026-03-29", "Changement d'heure");
    for (const tz of ["UTC", "Europe/Paris", "Pacific/Kiritimati", "America/Los_Angeles"]) {
      await db.exec(`SET TIME ZONE '${tz}'`);
      expect(await dayOf()).toBe("2026-03-29");
    }
    const type = await db.query<{ t: string }>(
      "SELECT data_type AS t FROM information_schema.columns WHERE table_name = 'social_calendar_notes' AND column_name = 'day'",
    );
    expect(type.rows[0].t).toBe("date");
  });

  it("enregistre l'auteur et refuse une note sans jour", async () => {
    await actAs(EMMA);
    await insertNote("2026-11-12", "Lancement AI4Product");
    const row = (await db.query<{ created_by: string; text: string; color: string }>(
      "SELECT created_by, text, color FROM social_calendar_notes",
    )).rows[0];
    expect(row).toEqual({ created_by: EMMA, text: "Lancement AI4Product", color: "#f97316" });
    await expect(db.query("INSERT INTO social_calendar_notes (text, color) VALUES ('x', '#f97316')")).rejects.toThrow(/null value/);
  });

  it("social_calendar_notes_set_created_by : l'auteur est l'appelant à la création et ne change plus ensuite", async () => {
    const authorOf = async () =>
      (await db.query<{ created_by: string | null }>("SELECT created_by FROM social_calendar_notes WHERE id = $1", [NOTE])).rows[0]?.created_by;
    await actAs(EMMA);
    await db.query(
      "INSERT INTO social_calendar_notes (id, day, text, color, created_by) VALUES ($1, '2026-11-12', 'Idée', '#f97316', $2)",
      [NOTE, OTHER],
    );
    expect(await authorOf()).toBe(EMMA);
    expect((await db.query("UPDATE social_calendar_notes SET created_by = $1 WHERE id = $2", [OTHER, NOTE])).affectedRows).toBe(1);
    expect(await authorOf()).toBe(EMMA);
    await db.query("UPDATE social_calendar_notes SET created_by = NULL, text = 'Idée revue' WHERE id = $1", [NOTE]);
    expect(await authorOf()).toBe(EMMA);
    await actAs(ADMIN);
    await db.query("UPDATE social_calendar_notes SET created_by = $1 WHERE id = $2", [ADMIN, NOTE]);
    expect(await authorOf()).toBe(EMMA);
  });

  it("refuse un texte vide ou fait uniquement de blancs", async () => {
    await actAs(EMMA);
    for (const blank of ["", "   ", "\t\n", "\u00a0", "\u202f\u3000"]) {
      await expect(insertNote("2026-11-12", blank)).rejects.toThrow(/social_calendar_notes_text_not_blank/);
    }
    await db.exec("RESET ROLE");
    expect((await db.query("SELECT * FROM social_calendar_notes")).rows).toHaveLength(0);
  });

  it("refuse un texte de plus de 500 caractères", async () => {
    await actAs(EMMA);
    await insertNote("2026-11-12", "a".repeat(500));
    await insertNote("2026-11-14", "🚀".repeat(500), "#f97316", "e3000000-0000-0000-0000-0000000000e3");
    await expect(insertNote("2026-11-13", "a".repeat(501), "#f97316", "e2000000-0000-0000-0000-0000000000e2"))
      .rejects.toThrow(/social_calendar_notes_text_length/);
  });

  it("refuse une couleur qui n'est pas au format #rrggbb minuscule, sans figer la palette", async () => {
    await actAs(EMMA);
    for (const color of ["#F97316", "orange", "#fff"]) {
      await expect(insertNote("2026-11-12", "Relance", color)).rejects.toThrow(/social_calendar_notes_color_format/);
    }
    await insertNote("2026-11-12", "Relance", "#123456");
  });

  it("social_set_created_by : l'auteur d'un contenu et d'un thème est l'appelant, figé ensuite", async () => {
    const GROUP = "f1000000-0000-0000-0000-0000000000f1";
    const THEME = "f2000000-0000-0000-0000-0000000000f2";
    await actAs(EMMA);
    await db.query("INSERT INTO social_content_groups (id, created_by) VALUES ($1, $2)", [GROUP, OTHER]);
    await db.query("INSERT INTO social_themes (id, name, color, created_by) VALUES ($1, 'Forgé', '#f97316', $2)", [THEME, OTHER]);
    const authors = async () => [
      (await db.query<{ created_by: string }>("SELECT created_by FROM social_content_groups WHERE id = $1", [GROUP])).rows[0]?.created_by,
      (await db.query<{ created_by: string }>("SELECT created_by FROM social_themes WHERE id = $1", [THEME])).rows[0]?.created_by,
    ];
    expect(await authors()).toEqual([EMMA, EMMA]);
    await db.query("UPDATE social_content_groups SET created_by = $1, sync = false WHERE id = $2", [OTHER, GROUP]);
    await db.query("UPDATE social_themes SET created_by = $1 WHERE id = $2", [OTHER, THEME]);
    expect(await authors()).toEqual([EMMA, EMMA]);
    await db.query("DELETE FROM social_content_groups WHERE id = $1", [GROUP]);
    await db.query("DELETE FROM social_themes WHERE id = $1", [THEME]);
  });

  it("déplace une note d'un jour à l'autre et met à jour updated_at", async () => {
    await actAs(EMMA);
    await insertNote("2026-11-12", "Relance");
    await db.exec("RESET ROLE");
    await db.query("UPDATE social_calendar_notes SET updated_at = '2020-01-01' WHERE id = $1", [NOTE]);
    await actAs(EMMA);
    expect((await db.query("UPDATE social_calendar_notes SET day = '2026-11-14' WHERE id = $1", [NOTE])).affectedRows).toBe(1);
    expect(await dayOf()).toBe("2026-11-14");
    const updated = await db.query<{ recent: boolean }>("SELECT updated_at > '2021-01-01' AS recent FROM social_calendar_notes");
    expect(updated.rows[0].recent).toBe(true);
  });

  it("un compte du module, hors Romain, crée, modifie et supprime une note", async () => {
    await actAs(EMMA);
    await insertNote("2026-11-12", "Idée");
    expect((await db.query("UPDATE social_calendar_notes SET text = 'Idée revue', color = '#3b82f6' WHERE id = $1", [NOTE])).affectedRows).toBe(1);
    expect((await db.query("SELECT * FROM social_calendar_notes")).rows).toHaveLength(1);
    expect((await db.query("DELETE FROM social_calendar_notes WHERE id = $1", [NOTE])).affectedRows).toBe(1);
  });

  it("un compte sans supertilt_fr ne lit, ne crée, ne modifie ni ne supprime aucune note", async () => {
    await actAs(EMMA);
    await insertNote("2026-11-12", "Idée");
    await actAs(OTHER);
    expect((await db.query("SELECT * FROM social_calendar_notes")).rows).toHaveLength(0);
    await expect(insertNote("2026-11-13", "Intrus", "#f97316", "e2000000-0000-0000-0000-0000000000e2")).rejects.toThrow(/row-level security/);
    expect((await db.query("UPDATE social_calendar_notes SET text = 'Piraté'")).affectedRows).toBe(0);
    expect((await db.query("DELETE FROM social_calendar_notes")).affectedRows).toBe(0);
    await db.exec("RESET ROLE");
    expect((await db.query<{ text: string }>("SELECT text FROM social_calendar_notes")).rows).toEqual([{ text: "Idée" }]);
  });

  it("les contraintes valent aussi à la modification", async () => {
    await actAs(EMMA);
    await insertNote("2026-11-12", "Idée");
    await expect(db.query("UPDATE social_calendar_notes SET text = '  ' WHERE id = $1", [NOTE])).rejects.toThrow(/text_not_blank/);
    await expect(db.query("UPDATE social_calendar_notes SET day = NULL WHERE id = $1", [NOTE])).rejects.toThrow(/null value/);
  });

  it("anon ne lit ni n'écrit aucune note", async () => {
    await actAs(EMMA);
    await insertNote("2026-11-12", "Idée");
    await actAs(null);
    expect((await db.query("SELECT * FROM social_calendar_notes")).rows).toHaveLength(0);
    await expect(insertNote("2026-11-13", "Intrus", "#f97316", "e2000000-0000-0000-0000-0000000000e2")).rejects.toThrow(/row-level security/);
    expect((await db.query("UPDATE social_calendar_notes SET text = 'Piraté'")).affectedRows).toBe(0);
    expect((await db.query("DELETE FROM social_calendar_notes")).affectedRows).toBe(0);
    await db.exec("RESET ROLE");
    expect((await db.query("SELECT * FROM social_calendar_notes")).rows).toHaveLength(1);
  });

  it("un admin sans ligne de droit gère les notes", async () => {
    await actAs(ADMIN);
    await insertNote("2026-11-12", "Idée");
    expect((await db.query("UPDATE social_calendar_notes SET day = '2026-11-20' WHERE id = $1", [NOTE])).affectedRows).toBe(1);
    expect((await db.query("SELECT * FROM social_calendar_notes")).rows).toHaveLength(1);
    expect((await db.query("DELETE FROM social_calendar_notes WHERE id = $1", [NOTE])).affectedRows).toBe(1);
  });
});
