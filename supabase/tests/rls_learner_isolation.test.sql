-- Tests RLS — isolation des données apprenants (règles 031 et 030 d'IMPROVEMENTS.md).
-- Exécution : supabase test db (nécessite l'instance locale : supabase db start).
-- Vérifie le COMPORTEMENT des policies, pas leur texte : un apprenant authentifié
-- (pas de profiles.is_admin, pas de user_module_access) ne doit lire aucune table staff.

begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

-- ── Seed (en tant que postgres, bypass RLS) ────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-4000-a000-000000000001', 'staff-rls-test@supertilt.fr', '{}'::jsonb),
  ('00000000-0000-4000-a000-000000000002', 'learner-rls-test@supertilt.fr', '{"role": "learner"}'::jsonb);

insert into public.profiles (user_id, email, is_admin)
values ('00000000-0000-4000-a000-000000000001', 'staff-rls-test@supertilt.fr', true);

insert into public.crm_columns (name) values ('rls-test-column');

-- ── 1-2. Mécanique : les policies existent sur toutes les tables staff ─────
-- Liste canonique de 20260529100000_staff_select_guard.sql
create temp table staff_tables (t text);
insert into staff_tables values
  ('crm_columns'), ('crm_tags'), ('crm_cards'), ('crm_card_tags'),
  ('crm_attachments'), ('crm_comments'), ('crm_card_emails'), ('crm_activity_log'),
  ('missions'), ('mission_activities'), ('mission_credits'), ('mission_media'), ('mission_pages'),
  ('quotes'), ('quote_settings'),
  ('watch_clusters'), ('watch_digests'), ('watch_items'),
  ('improvements'), ('newsletters'), ('newsletter_cards'), ('email_templates'),
  ('training_supports'), ('training_support_sections'),
  ('training_support_templates'), ('training_support_template_sections'),
  ('training_support_media'), ('training_support_imports'),
  ('coaching_summaries'), ('evaluation_analyses'), ('woocommerce_coupons'),
  ('session_start_notifications'), ('agent_schema_registry');

select is(
  (select count(*)::int from staff_tables s
   where exists (select 1 from information_schema.tables it
                 where it.table_schema = 'public' and it.table_name = s.t)
     and not exists (select 1 from pg_policies p
                     where p.schemaname = 'public' and p.tablename = s.t
                       and p.policyname = 'staff_only_select')),
  0,
  'toutes les tables staff existantes ont la policy RESTRICTIVE staff_only_select'
);

select is(
  (select count(*)::int from staff_tables s
   join pg_class c on c.relname = s.t
   join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
   where not c.relrowsecurity),
  0,
  'RLS est activé sur toutes les tables staff'
);

-- ── 3-4. Comportement : apprenant authentifié ──────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-a000-000000000002", "email": "learner-rls-test@supertilt.fr", "role": "authenticated", "user_metadata": {"role": "learner"}}',
  true);

select ok(not public.is_staff_user(), 'is_staff_user() est false pour un apprenant');

select is(
  (select count(*)::int from public.crm_columns),
  0,
  'un apprenant authentifié lit zéro ligne dans crm_columns'
);

-- ── 5-6. Comportement : staff admin ────────────────────────────────────────
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-a000-000000000001", "email": "staff-rls-test@supertilt.fr", "role": "authenticated"}',
  true);

select ok(public.is_staff_user(), 'is_staff_user() est true pour un admin');

select cmp_ok(
  (select count(*)::int from public.crm_columns),
  '>=', 1,
  'un admin lit les lignes de crm_columns'
);

select * from finish();
rollback;
