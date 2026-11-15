import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
let db: PGlite;
const owner = '81d0328b-7651-4deb-95c0-c7ac81eb952e';
const other = '00000000-0000-4000-8000-000000000001';
beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE anon; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT 'authenticated'::text $$;
    CREATE FUNCTION public.is_admin(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT $1='${owner}'::uuid $$;
    CREATE FUNCTION public.is_staff_user() RETURNS boolean LANGUAGE sql AS $$ SELECT auth.uid() IS NOT NULL $$;
    CREATE TABLE profiles(user_id uuid,email text);
    INSERT INTO profiles VALUES('${owner}','romain@supertilt.fr'),('${other}','other@example.test');
    CREATE TABLE audit_runs(id uuid DEFAULT gen_random_uuid(),notes text,findings jsonb,started_at timestamptz DEFAULT now());
    CREATE TABLE watch_sources(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text,url text,why text,how_to_follow text,status text);
    CREATE TABLE daily_actions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,action_date date,category text,entity_type text,entity_id text,title text,description text,link text,is_completed boolean DEFAULT false,completed_at timestamptz,auto_completed boolean DEFAULT false,created_at timestamptz DEFAULT now(),UNIQUE(user_id,action_date,category,entity_type,entity_id));
    CREATE TABLE activity_logs(user_id uuid,recipient_email text,action_type text,details jsonb);`);
  await db.exec(fs.readFileSync('drizzle/migrations/0068_daily_quality_visibility.sql', 'utf8'));
});
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec(`DELETE FROM daily_actions; DELETE FROM audit_runs; DELETE FROM watch_sources; DELETE FROM activity_logs; SELECT set_config('test.uid','${owner}',false);`);
});
const sync = () => db.query('SELECT sync_daily_quality_actions($1)', [owner]);
const active = async (category: string) => (await db.query('SELECT id FROM daily_actions WHERE category=$1 AND NOT is_completed', [category])).rows;
describe('Synchronisation réelle des actions qualité', () => {
  it('réconcilie 100 anciennes actions en une par écart et reste idempotente', async () => {
    await db.exec(`INSERT INTO audit_runs(notes,findings) VALUES('Passage automatique : test','[{"checkId":"1.mentions","indicator":1,"label":"Mentions","detail":"21/24"}]');
      INSERT INTO daily_actions(user_id,action_date,category,entity_type,entity_id,title) SELECT '${owner}',date '2026-01-01'+n,'qualiopi','qualiopi_check','1.mentions','Ancienne' FROM generate_series(1,100)n;`);
    await sync();
    expect(await active('qualiopi')).toHaveLength(1);
    await sync();
    expect((await db.query('SELECT id FROM daily_actions')).rows).toHaveLength(100);
  });
  it('ferme un écart disparu du passage suivant', async () => {
    await db.exec(`INSERT INTO audit_runs(notes,findings) VALUES('Passage automatique : test','[{"checkId":"1.mentions","indicator":1,"label":"Mentions","detail":"21/24"}]');`);
    await sync();
    await db.exec(`UPDATE audit_runs SET findings='[]'`);
    await sync();
    expect(await active('qualiopi')).toHaveLength(0);
  });
  it('crée 32 actions de validation sans doublons', async () => {
    await db.exec(`INSERT INTO watch_sources(name,url,why,status) SELECT 'Source '||n,'https://example.test/'||n,'Pertinente','proposed' FROM generate_series(1,32)n`);
    await sync(); await sync();
    expect(await active('watch_sources_validate')).toHaveLength(32);
  });
  it('à abonner crée une action puis fait passe en followed et ferme celle-ci', async () => {
    const source = (await db.query<{id:string}>(`INSERT INTO watch_sources(name,url,status) VALUES('X','https://example.test','proposed') RETURNING id`)).rows[0];
    await sync();
    await db.query('SELECT decide_daily_watch_source($1,$2)',[source.id,'to_subscribe']);
    expect(await active('watch_sources_validate')).toHaveLength(0);
    expect(await active('watch_sources_subscribe')).toHaveLength(1);
    await db.query('SELECT decide_daily_watch_source($1,$2)',[source.id,'followed']);
    expect((await db.query<{status:string}>('SELECT status FROM watch_sources')).rows[0].status).toBe('followed');
    expect(await active('watch_sources_subscribe')).toHaveLength(0);
    expect((await db.query("SELECT * FROM activity_logs WHERE action_type='watch_source_decision'")).rows).toHaveLength(2);
  });
  it('écarter ferme la proposition', async () => {
    const s = (await db.query<{id:string}>(`INSERT INTO watch_sources(name,url,status) VALUES('X','https://example.test','proposed') RETURNING id`)).rows[0];
    await sync(); await db.query('SELECT decide_daily_watch_source($1,$2)',[s.id,'dropped']);
    expect(await active('watch_sources_validate')).toHaveLength(0);
  });
  it('refuse la synchronisation pour un autre compte', async () => {
    await db.exec(`SELECT set_config('test.uid','${other}',false)`);
    await expect(sync()).rejects.toThrow('Unauthorized');
  });
  it('ne propose aucune source aux autres comptes', async () => {
    await db.exec(`INSERT INTO watch_sources(name,url,status) VALUES('X','https://example.test','proposed'); SELECT set_config('test.uid','${other}',false)`);
    await db.query('SELECT sync_daily_quality_actions($1)',[other]);
    expect(await active('watch_sources_validate')).toHaveLength(0);
  });
});