import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const user = '11111111-1111-4111-8111-111111111111';
const card = '22222222-2222-4222-8222-222222222222';
const game = '33333333-3333-4333-8333-333333333333';
let db: PGlite;

const quote = {
  crm_card_id: card,
  customer_first_name: 'Pauline',
  customer_last_name: 'Delsoir',
  customer_email: 'pauline.delsoir@clpsms.be',
  billing_address: { address_1: 'Rue de la Loi 30', postcode: '7100', city: 'La Louvière', country: 'BE' },
  shipping_address: { address_1: 'Rue de la Loi 30', postcode: '7100', city: 'La Louvière', country: 'BE' },
  total_ht: 100,
  total_tax: 20,
  total_ttc: 120,
  shipping_total: 0,
  admin_fee: 0,
  crm_comment: 'Devis jeux créé en brouillon via MCP.',
  activity_details: { client_name: 'CLPS Mons-Soignies', status: 'draft' },
};
const items = [{ game_id: game, product_name: 'ECHO', game_type: 'partner', quantity: 2, unit_price: 50, line_total: 100, wc_product_id: 78179 }];

describe('Devis jeux MCP en base', () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${user}'::uuid $$;
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT '{"email":"test@example.invalid"}'::jsonb $$;
      CREATE FUNCTION public.is_staff_user() RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.staff',true)='true' $$;
      CREATE FUNCTION public.is_admin(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.admin',true)='true' $$;
      CREATE FUNCTION public.has_module_access(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.module',true)='true' $$;
      CREATE TABLE public.games(id uuid PRIMARY KEY,title text,status text);
      CREATE TABLE public.crm_cards(id uuid PRIMARY KEY,title text);
      CREATE TABLE public.activity_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),action_type text,recipient_email text,user_id uuid,details jsonb);
      CREATE TABLE public.devis_order_counters(year integer PRIMARY KEY,last_value integer NOT NULL DEFAULT 0);
      CREATE SEQUENCE public.devis_order_wc_id_seq START 1;
      CREATE TABLE public.woocommerce_orders(
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),wc_order_id integer UNIQUE,order_number text,wc_status text,date_created timestamptz,
        customer_first_name text,customer_last_name text,customer_email text,billing_address jsonb,shipping_address jsonb,
        total_ttc numeric,total_ht numeric,total_tax numeric,shipping_total numeric,payment_method text,payment_method_title text,
        line_items jsonb,raw_order jsonb,processed_at timestamptz,source text,devis_activity_log_id uuid,crm_card_id uuid,created_by uuid,cancelled_at timestamptz
      );
      CREATE TABLE public.order_items(
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),woocommerce_order_id uuid,wc_order_id integer,wc_product_id integer,wc_variation_id integer,
        product_name text,game_id uuid,game_type text,quantity integer,unit_price numeric,line_total numeric,kanban_status text,
        validation_status text,raw_line_item jsonb,block_reason text
      );
      CREATE TABLE public.crm_comments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),card_id uuid,author_email text,content text);
      CREATE TABLE public.crm_activity_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),card_id uuid,action_type text,new_value text,actor_email text,metadata jsonb);
      INSERT INTO public.games VALUES('${game}','ECHO','active');
      INSERT INTO public.crm_cards VALUES('${card}','Devis ECHO x2');`);
    await db.exec(readFileSync('drizzle/migrations/0067_game_quotes.sql', 'utf8'));
  });

  beforeEach(async () => {
    await db.exec(`SET test.staff='true'; SET test.admin='false'; SET test.module='true';
      TRUNCATE public.activity_logs,public.woocommerce_orders,public.order_items,public.crm_comments,public.crm_activity_log,public.devis_order_counters;
      ALTER SEQUENCE public.devis_order_wc_id_seq RESTART WITH 1;`);
  });

  afterAll(async () => db.close());

  it('refuse un appel sans le droit dropshipping', async () => {
    await db.exec("SET test.staff='true'; SET test.module='false'");
    await expect(db.query('SELECT public.create_game_quote($1,$2)', [quote, items])).rejects.toThrow('Accès dropshipping requis');
    expect((await db.query('SELECT * FROM public.woocommerce_orders')).rows).toHaveLength(0);
  });

  it('crée un brouillon DV avec PDF tracé, lignes et commentaire, sans commande payée', async () => {
    const result = await db.query<{ result: { id: string; order_number: string; status: string; crm_comment_id: string } }>('SELECT public.create_game_quote($1,$2) AS result', [quote, items]);
    expect(result.rows[0].result.status).toBe('draft');
    expect(result.rows[0].result.order_number).toMatch(/^DV-\d{4}-0001$/);
    expect(result.rows[0].result.crm_comment_id).toBeTruthy();
    const orders = await db.query<{ wc_status: string; source: string; processed_at: string | null; total_ttc: string }>('SELECT wc_status,source,processed_at,total_ttc FROM public.woocommerce_orders');
    expect(orders.rows).toEqual([expect.objectContaining({ wc_status: 'draft', source: 'devis', processed_at: null, total_ttc: '120.00' })]);
    const lines = await db.query<{ kanban_status: string; validation_status: string; quantity: number }>('SELECT kanban_status,validation_status,quantity FROM public.order_items');
    expect(lines.rows).toEqual([{ kanban_status: 'quote_draft', validation_status: 'pending', quantity: 2 }]);
    expect((await db.query("SELECT * FROM public.activity_logs WHERE action_type='game_devis_draft'")).rows).toHaveLength(1);
    expect((await db.query('SELECT * FROM public.crm_comments')).rows).toHaveLength(1);
    expect((await db.query('SELECT * FROM public.crm_activity_log')).rows).toHaveLength(2);
  });

  it('accepte plusieurs brouillons et ne les confond pas avec une commande gagnée', async () => {
    await db.query('SELECT public.create_game_quote($1,$2)', [quote, items]);
    await db.query('SELECT public.create_game_quote($1,$2)', [quote, items]);
    expect((await db.query("SELECT * FROM public.woocommerce_orders WHERE wc_status='draft'")).rows).toHaveLength(2);
    const result = await db.query<{ result: { id: string; order_number: string; existing: boolean } }>('SELECT public.create_devis_order($1,$2) AS result', [{ ...quote, created_by: user, actor_email: 'test@example.invalid', devis_activity_log_id: '' }, items]);
    expect(result.rows[0].result.existing).toBe(false);
    expect((await db.query("SELECT * FROM public.woocommerce_orders WHERE wc_status='processing'")).rows).toHaveLength(1);
    expect((await db.query('SELECT * FROM public.woocommerce_orders')).rows).toHaveLength(3);
  });
});
