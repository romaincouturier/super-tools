CREATE OR REPLACE FUNCTION public._backup_pk(p_table text)
RETURNS TABLE(col text, typ text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.attname::text, format_type(a.atttypid, a.atttypmod)
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  JOIN LATERAL unnest(i.indkey) WITH ORDINALITY k(attnum, ord) ON true
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
  WHERE c.relname = p_table AND i.indisprimary
  ORDER BY k.ord
$$;

-- Page ordonnée par clé primaire + empreinte (somme de hachages de lignes, indépendante du découpage).
CREATE OR REPLACE FUNCTION public.backup_export_page(p_table text, p_after text[] DEFAULT NULL, p_limit int DEFAULT 200, p_with_rows boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cols text[]; typs text[]; order_sql text; where_sql text := ''; tuple_sql text; sql text; res jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = p_table) THEN
    RAISE EXCEPTION 'table inconnue: %', p_table;
  END IF;
  SELECT array_agg(col), array_agg(typ) INTO cols, typs FROM public._backup_pk(p_table);
  IF cols IS NULL THEN RAISE EXCEPTION 'pas de clé primaire: %', p_table; END IF;
  SELECT string_agg(format('t.%I', c), ', ') INTO order_sql FROM unnest(cols) c;
  tuple_sql := '(' || order_sql || ')';
  IF p_after IS NOT NULL THEN
    SELECT '(' || string_agg(format('%L::%s', p_after[i], typs[i]), ', ') || ')' INTO where_sql
    FROM generate_subscripts(cols, 1) i;
    where_sql := ' WHERE ' || tuple_sql || ' > ' || where_sql;
  END IF;
  sql := format(
    'WITH p AS (SELECT row_to_json(t) AS j, ARRAY[%s] AS k FROM public.%I t%s ORDER BY %s LIMIT %s)
     SELECT jsonb_build_object(
       ''n'', count(*),
       ''fp'', coalesce(sum((''x'' || left(md5(j::text), 15))::bit(60)::bigint::numeric), 0)::text,
       ''last'', (array_agg(to_jsonb(k)))[count(*)],
       ''rows'', CASE WHEN %L THEN coalesce(json_agg(j)::jsonb, ''[]''::jsonb) ELSE NULL END)
     FROM p',
    (SELECT string_agg(format('t.%I::text', c), ', ') FROM unnest(cols) c),
    p_table, where_sql, order_sql, greatest(1, least(p_limit, 50000)), p_with_rows);
  EXECUTE sql INTO res;
  RETURN res;
END $$;

-- Lignes créées/modifiées depuis un instant (null si la table n'a pas de colonne de date).
CREATE OR REPLACE FUNCTION public.backup_changed_since(p_table text, p_since timestamptz)
RETURNS bigint
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE conds text; n bigint;
BEGIN
  SELECT string_agg(format('%I >= %L', column_name, p_since), ' OR ') INTO conds
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = p_table
    AND column_name IN ('updated_at', 'created_at') AND data_type LIKE 'timestamp%';
  IF conds IS NULL THEN RETURN NULL; END IF;
  EXECUTE format('SELECT count(*) FROM public.%I WHERE %s', p_table, conds) INTO n;
  RETURN n;
END $$;

-- Comptes de connexion (lecture seule) pour recréer les accès sur une autre plateforme.
CREATE OR REPLACE FUNCTION public.backup_auth_users_export()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT jsonb_build_object(
    'users', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', u.id, 'email', u.email, 'encrypted_password', u.encrypted_password,
        'email_confirmed_at', u.email_confirmed_at, 'created_at', u.created_at,
        'last_sign_in_at', u.last_sign_in_at, 'raw_app_meta_data', u.raw_app_meta_data,
        'raw_user_meta_data', u.raw_user_meta_data, 'banned_until', u.banned_until,
        'deleted_at', u.deleted_at) ORDER BY u.created_at) FROM auth.users u), '[]'::jsonb),
    'identities', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'user_id', i.user_id, 'provider', i.provider, 'provider_id', i.provider_id,
        'identity_data', i.identity_data, 'created_at', i.created_at)) FROM auth.identities i), '[]'::jsonb)
  )
$$;

-- Structure de la base : colonnes, contraintes, règles d'accès, fonctions, tâches planifiées.
CREATE OR REPLACE FUNCTION public.backup_schema_inventory()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'columns', (SELECT jsonb_agg(jsonb_build_object('table', table_name, 'column', column_name, 'type', data_type,
        'udt', udt_name, 'nullable', is_nullable, 'default', column_default) ORDER BY table_name, ordinal_position)
      FROM information_schema.columns WHERE table_schema = 'public'),
    'constraints', (SELECT jsonb_agg(jsonb_build_object('table', conrelid::regclass::text, 'name', conname,
        'def', pg_get_constraintdef(oid)))
      FROM pg_constraint WHERE connamespace = 'public'::regnamespace),
    'indexes', (SELECT jsonb_agg(jsonb_build_object('table', tablename, 'name', indexname, 'def', indexdef))
      FROM pg_indexes WHERE schemaname = 'public'),
    'policies', (SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p WHERE schemaname IN ('public', 'storage')),
    'rls', (SELECT jsonb_agg(jsonb_build_object('table', relname, 'enabled', relrowsecurity))
      FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'),
    'enums', (SELECT jsonb_agg(jsonb_build_object('type', t.typname, 'values',
        (SELECT jsonb_agg(enumlabel ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = t.oid)))
      FROM pg_type t WHERE t.typnamespace = 'public'::regnamespace AND t.typtype = 'e'),
    'functions', (SELECT jsonb_agg(jsonb_build_object('name', p.proname, 'def', pg_get_functiondef(p.oid)))
      FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.prokind IN ('f', 'p')),
    'triggers', (SELECT jsonb_agg(jsonb_build_object('table', tgrelid::regclass::text, 'name', tgname,
        'def', pg_get_triggerdef(oid)))
      FROM pg_trigger WHERE NOT tgisinternal AND tgrelid::regclass::text NOT LIKE '%.%'),
    'cron_jobs', (SELECT jsonb_agg(jsonb_build_object('name', jobname, 'schedule', schedule,
        'command', regexp_replace(command, '(Bearer |apikey"?\s*[:=]\s*"?)[A-Za-z0-9._-]{20,}', '\1***', 'g'))) FROM cron.job),
    'buckets', (SELECT jsonb_agg(jsonb_build_object('id', id, 'public', public, 'file_size_limit', file_size_limit))
      FROM storage.buckets)
  )
$$;

REVOKE ALL ON FUNCTION public._backup_pk(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.backup_export_page(text, text[], int, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.backup_changed_since(text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.backup_auth_users_export() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.backup_schema_inventory() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._backup_pk(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.backup_export_page(text, text[], int, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.backup_changed_since(text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.backup_auth_users_export() TO service_role;
GRANT EXECUTE ON FUNCTION public.backup_schema_inventory() TO service_role;