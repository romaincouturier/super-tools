import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import fs from 'node:fs';

let db: PGlite;
const owner = '81d0328b-7651-4deb-95c0-c7ac81eb952e';
const other = '00000000-0000-4000-8000-000000000002';
const album = '00000000-0000-4000-8000-000000000003';
const production = 'c2ea89b2-70ab-431f-b564-56cd28aec1b3';
const run = '00000000-0000-4000-8000-000000000004';
const tags = ['écologie','pollution','santé','équipe','pictogramme'];
beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('app.user',true),'')::uuid $$;
    CREATE FUNCTION public.has_module_access(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('app.module',true),'false')='true' $$;
    GRANT USAGE ON SCHEMA auth TO authenticated,anon,service_role; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon,service_role;
    CREATE TABLE book_albums(id uuid PRIMARY KEY,title text,user_id uuid);
    CREATE TABLE book_productions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),album_id uuid,user_id uuid,title text,original_filename text,file_type text,file_url text,thumbnail_url text,tags text[] NOT NULL DEFAULT '{}',notes text,created_at timestamptz DEFAULT now());
    CREATE TABLE activity_logs(id uuid DEFAULT gen_random_uuid(),action_type text,user_id uuid,recipient_email text NOT NULL,details jsonb);
    GRANT SELECT ON book_albums,book_productions TO authenticated;
    ALTER TABLE book_albums ENABLE ROW LEVEL SECURITY; ALTER TABLE book_productions ENABLE ROW LEVEL SECURITY;
    CREATE POLICY albums_read ON book_albums TO authenticated USING(user_id=auth.uid() OR has_module_access(auth.uid(),'book'));
    CREATE POLICY productions_read ON book_productions TO authenticated USING(user_id=auth.uid() OR has_module_access(auth.uid(),'book'));`);
  await db.exec(fs.readFileSync('drizzle/migrations/0076_book_visual_indexing.sql','utf8'));
  await db.exec(fs.readFileSync('drizzle/migrations/0077_book_analysis_field_guards.sql','utf8'));
  await db.exec(fs.readFileSync('drizzle/migrations/0078_book_manual_title_protection.sql','utf8'));
  await db.exec(fs.readFileSync('drizzle/migrations/0079_book_analysis_audit_recipient.sql','utf8'));
}, 30000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec(`RESET ROLE; SELECT set_config('app.user','${owner}',false),set_config('app.module','false',false); DELETE FROM book_analysis_jobs; DELETE FROM book_analysis_control; DELETE FROM book_productions; DELETE FROM book_albums; DELETE FROM activity_logs;`);
  await db.query('INSERT INTO book_albums VALUES($1,$2,$3)',[album,'Écologie',owner]);
  await db.query('INSERT INTO book_productions(id,album_id,user_id,title,original_filename,file_type,file_url) VALUES($1,$2,$3,$4,$5,$6,$7)',[production,album,owner,'IMG_4093','IMG_4093.jpg','image','u/a/p.jpg']);
});
async function finish(title='Planète') {
  await db.exec("SELECT set_config('app.user','',false)");
  try { await db.query('SELECT finish_book_analysis($1,$2,$3,$4,$5)',[production,run,title,tags,'Un dessin écologique.']); }
  finally { await db.exec(`SELECT set_config('app.user','${owner}',false)`); }
}
it('enqueue_book_image met chaque nouvelle image en file une seule fois', async () => {
  const { rows } = await db.query('SELECT count(*)::int AS n FROM book_analysis_jobs'); expect(rows[0].n).toBe(1);
  await db.exec(`INSERT INTO book_productions(file_type) VALUES('video')`);
  expect((await db.query('SELECT count(*)::int AS n FROM book_analysis_jobs')).rows[0].n).toBe(1);
});
it('borne à trois images et interdit un deuxième traitement concurrent', async () => {
  await db.exec(`INSERT INTO book_productions(file_type) SELECT 'image' FROM generate_series(1,5)`);
  expect((await db.query('SELECT * FROM claim_book_analysis($1)',[run])).rows).toHaveLength(3);
  expect((await db.query('SELECT * FROM claim_book_analysis(gen_random_uuid())')).rows).toHaveLength(0);
});
it('enrichit titre brut, cinq tags et notes vides en journalisant', async () => {
  await db.query('SELECT * FROM claim_book_analysis($1)',[run]); await finish();
  expect((await db.query('SELECT title,tags,notes FROM book_productions WHERE id=$1',[production])).rows[0]).toEqual({ title:'Planète',tags,notes:'Un dessin écologique.' });
  expect((await db.query("SELECT count(*)::int AS n FROM activity_logs WHERE action_type='book_image_analyzed'")).rows[0].n).toBe(1);
});
it('préserve un titre manuel même si le serveur propose un remplacement', async () => {
  await db.query("UPDATE book_productions SET title='Atelier personnel' WHERE id=$1",[production]);
  await db.query('SELECT * FROM claim_book_analysis($1)',[run]); await finish();
  expect((await db.query('SELECT title FROM book_productions WHERE id=$1',[production])).rows[0].title).toBe('Atelier personnel');
});
it('préserve les modifications manuelles pendant une régénération', async () => {
  await db.query('SELECT request_book_analysis($1)',[production]); await db.query('SELECT * FROM claim_book_analysis($1)',[run]);
  await db.query("UPDATE book_productions SET title='Titre humain',tags=ARRAY['humain'],notes='Note humaine' WHERE id=$1",[production]); await finish();
  expect((await db.query('SELECT title,tags,notes FROM book_productions WHERE id=$1',[production])).rows[0]).toEqual({title:'Titre humain',tags:['humain'],notes:'Note humaine'});
});
it('ne remplace pas les tags ni les notes manuels en rattrapage', async () => {
  await db.query("UPDATE book_productions SET tags=ARRAY['manuel'],notes='Déjà décrit' WHERE id=$1",[production]);
  await db.query('SELECT * FROM claim_book_analysis($1)',[run]); await finish();
  expect((await db.query('SELECT tags,notes FROM book_productions WHERE id=$1',[production])).rows[0]).toEqual({tags:['manuel'],notes:'Déjà décrit'});
});
it('bloque les appels planifiés quand le traitement est en pause', async () => {
  await db.exec("INSERT INTO book_analysis_control(id,pause_reason) VALUES(true,'Crédits requis')");
  expect((await db.query('SELECT * FROM claim_book_analysis($1)',[run])).rows).toHaveLength(0);
});
it('refuse une régénération hors droits et ne change rien', async () => {
  await db.exec(`SELECT set_config('app.user','${other}',false); SET ROLE authenticated;`);
  await expect(db.query('SELECT request_book_analysis($1)',[production])).rejects.toThrow('Accès Book requis');
  expect((await db.query('SELECT * FROM book_analysis_jobs')).rows).toHaveLength(0);
});
it('interdit la prise de lot à un utilisateur connecté', async () => {
  await db.exec('SET ROLE authenticated');
  await expect(db.query('SELECT * FROM claim_book_analysis($1)',[run])).rejects.toThrow('permission denied');
});
it('cherche les titres, tags et notes sans accents ni casse sous RLS', async () => {
  await db.query("UPDATE book_productions SET title='ÉCOLOGIE',tags=ARRAY['santé'],notes='Une équipe dessinée' WHERE id=$1",[production]);
  await db.exec('SET ROLE authenticated');
  for (const query of ['ecologie','SANTE','equipe']) expect((await db.query('SELECT * FROM search_book_productions($1)',[query])).rows).toHaveLength(1);
  await db.exec(`SELECT set_config('app.user','${other}',false)`);
  expect((await db.query("SELECT * FROM search_book_productions('ecologie')")).rows).toHaveLength(0);
});
it('filtre par album et ne traite pas les pourcentages comme jokers', async () => {
  expect((await db.query('SELECT * FROM search_book_productions($1,$2,$3)',['IMG','ecologie',1])).rows).toHaveLength(1);
  expect((await db.query('SELECT * FROM search_book_productions($1,$2,$3)',['IMG','autre',1])).rows).toHaveLength(0);
  expect((await db.query("SELECT * FROM search_book_productions('%')")).rows).toHaveLength(0);
});
it('book_search_normalize normalise les caractères français', async () => {
  expect((await db.query("SELECT book_search_normalize('ÉCOLOGIE ŒUVRE') AS value")).rows[0].value).toBe('ecologie oeuvre');
});
it('réserve resume_book_analysis au module Book', async () => {
  await db.exec("INSERT INTO book_analysis_control(id,pause_reason) VALUES(true,'Crédits requis'); SET ROLE authenticated");
  await expect(db.query('SELECT resume_book_analysis()')).rejects.toThrow('Accès Book requis');
  await db.exec("SELECT set_config('app.module','true',false)");
  await db.query('SELECT resume_book_analysis()');
  expect((await db.query('SELECT pause_reason FROM book_analysis_control')).rows[0].pause_reason).toBe(null);
});
it('ne relance pas une génération interrompue dont le résultat est inconnu', async () => {
  await db.query('SELECT * FROM claim_book_analysis($1)',[run]);
  await db.exec("UPDATE book_analysis_control SET lease_until=now()-interval '1 minute'");
  expect((await db.query('SELECT * FROM claim_book_analysis(gen_random_uuid())')).rows).toHaveLength(0);
  expect((await db.query('SELECT status,error_message FROM book_analysis_jobs')).rows[0].status).toBe('error');
});
it('protège même un titre de fichier réécrit manuellement via book_metadata_manual_guard et book_analysis_title_guard', async () => {
  await db.query("UPDATE book_productions SET title='IMG_9999' WHERE id=$1",[production]);
  await db.query('SELECT * FROM claim_book_analysis($1)',[run]); await finish();
  expect((await db.query('SELECT title,title_manual FROM book_productions WHERE id=$1',[production])).rows[0]).toEqual({title:'IMG_9999',title_manual:true});
});
it('refuse moins de cinq tags sans rien enregistrer', async () => {
  await db.query('SELECT * FROM claim_book_analysis($1)',[run]);
  await expect(db.query('SELECT finish_book_analysis($1,$2,$3,$4,$5)',[production,run,'Planète',['écologie'],'Note'])).rejects.toThrow('5 à 12 tags requis');
  expect((await db.query('SELECT tags FROM book_productions WHERE id=$1',[production])).rows[0].tags).toEqual([]);
});