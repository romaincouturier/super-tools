-- Agent SQL — la coupe à 100 lignes cesse d'être silencieuse.
--
-- Constat : agent_sql_query injecte `LIMIT 100` dans la requête et renvoie un
-- tableau nu. Vérifié en conditions réelles — une demande portant sur 776
-- lignes en renvoyait exactement 100, sans le moindre signal. Le modèle reçoit
-- 100 lignes qui ressemblent au résultat complet et répond faux avec assurance.
-- Aucune instruction de prompt ne peut corriger cela : l'information manque.
--
-- La fonction renvoie désormais un objet :
--   { rows, row_count, limit, truncated, note }
-- `truncated` est déterminé en demandant 101 lignes et en constatant la 101e.
-- Seuls agent-chat et mcp-server appellent cette fonction, tous deux en
-- JSON.stringify du résultat : le changement de forme leur profite directement.

CREATE OR REPLACE FUNCTION public.agent_sql_query(
  query_text text,
  p_user_id uuid DEFAULT NULL,
  p_explanation text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  normalized text;
  clean_query text;
  allowed_tables text[];
  plan_json jsonb;
  plan_tables text[];
  hidden_cols_map jsonb;
  t text;
  col text;
  tbl_name text;
  tbl_hidden text[];
  row_cnt int;
  start_ts timestamptz;
  elapsed_ms int;
  row_limit constant int := 100;
  was_truncated boolean;
BEGIN
  start_ts := clock_timestamp();

  clean_query := regexp_replace(trim(query_text), ';\s*$', '');
  normalized := lower(clean_query);

  IF NOT (normalized LIKE 'select%' OR normalized LIKE 'with%') THEN
    INSERT INTO public.agent_query_audit_log (user_id, query_text, explanation, success, error_message, execution_ms)
    VALUES (p_user_id, query_text, p_explanation, false, 'Only SELECT queries are allowed',
            EXTRACT(MILLISECONDS FROM clock_timestamp() - start_ts)::int);
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;

  IF normalized ~ '\m(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|execute)\M' THEN
    INSERT INTO public.agent_query_audit_log (user_id, query_text, explanation, success, error_message, execution_ms)
    VALUES (p_user_id, query_text, p_explanation, false, 'Write operations are not allowed',
            EXTRACT(MILLISECONDS FROM clock_timestamp() - start_ts)::int);
    RAISE EXCEPTION 'Write operations are not allowed';
  END IF;

  IF clean_query ~ ';' THEN
    INSERT INTO public.agent_query_audit_log (user_id, query_text, explanation, success, error_message, execution_ms)
    VALUES (p_user_id, query_text, p_explanation, false, 'Multiple statements are not allowed',
            EXTRACT(MILLISECONDS FROM clock_timestamp() - start_ts)::int);
    RAISE EXCEPTION 'Multiple statements are not allowed';
  END IF;

  BEGIN
    EXECUTE format('EXPLAIN (FORMAT JSON) %s', clean_query) INTO plan_json;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.agent_query_audit_log (user_id, query_text, explanation, success, error_message, execution_ms)
    VALUES (p_user_id, query_text, p_explanation, false, format('SQL parse error: %s', SQLERRM),
            EXTRACT(MILLISECONDS FROM clock_timestamp() - start_ts)::int);
    RAISE;
  END;

  BEGIN
    SELECT array_agg(DISTINCT trim(both '"' FROM val::text))
    INTO plan_tables
    FROM jsonb_path_query(plan_json, 'lax $.**."Relation Name"') AS val
    WHERE val IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    plan_tables := NULL;
  END;

  allowed_tables := public.get_agent_allowed_tables();

  IF plan_tables IS NOT NULL THEN
    FOREACH t IN ARRAY plan_tables LOOP
      IF NOT (t = ANY(allowed_tables)) THEN
        INSERT INTO public.agent_query_audit_log (user_id, query_text, explanation, success, error_message, execution_ms)
        VALUES (p_user_id, query_text, p_explanation, false, format('Table not allowed: %s', t),
                EXTRACT(MILLISECONDS FROM clock_timestamp() - start_ts)::int);
        RAISE EXCEPTION 'Access denied: table "%" is not in the allowed list', t;
      END IF;
    END LOOP;
  END IF;

  SELECT jsonb_object_agg(r.table_name, r.hidden_columns)
  INTO hidden_cols_map
  FROM public.agent_schema_registry r
  WHERE r.is_queryable = true
    AND array_length(r.hidden_columns, 1) > 0;

  IF hidden_cols_map IS NOT NULL THEN
    FOR tbl_name, tbl_hidden IN
      SELECT key, array_agg(elem)
      FROM jsonb_each(hidden_cols_map), jsonb_array_elements_text(value) AS elem
      GROUP BY key
    LOOP
      FOREACH col IN ARRAY tbl_hidden LOOP
        IF normalized ~ ('\m' || lower(col) || '\M') THEN
          INSERT INTO public.agent_query_audit_log (user_id, query_text, explanation, success, error_message, execution_ms)
          VALUES (p_user_id, query_text, p_explanation, false,
                  format('Access denied: column "%s.%s" is restricted', tbl_name, col),
                  EXTRACT(MILLISECONDS FROM clock_timestamp() - start_ts)::int);
          RAISE EXCEPTION 'Access denied: column "%.%" is restricted', tbl_name, col;
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  SET LOCAL statement_timeout = '10s';
  -- On demande une ligne de plus que le plafond : sa présence prouve que le
  -- résultat est incomplet, ce qu'aucun LIMIT 100 nu ne permet de savoir.
  EXECUTE format(
    'SELECT jsonb_agg(row_to_json(sub)) FROM (SELECT * FROM (%s) _inner LIMIT %s) sub',
    clean_query, row_limit + 1
  ) INTO result;

  result := COALESCE(result, '[]'::jsonb);
  was_truncated := jsonb_array_length(result) > row_limit;
  IF was_truncated THEN
    result := (SELECT jsonb_agg(e) FROM (
      SELECT e FROM jsonb_array_elements(result) AS e LIMIT row_limit
    ) sub);
  END IF;

  row_cnt := jsonb_array_length(result);
  elapsed_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - start_ts)::int;

  INSERT INTO public.agent_query_audit_log (user_id, query_text, explanation, success, row_count, execution_ms)
  VALUES (p_user_id, query_text, p_explanation, true, row_cnt, elapsed_ms);

  RETURN jsonb_build_object(
    'rows', result,
    'row_count', row_cnt,
    'limit', row_limit,
    'truncated', was_truncated,
    'note', CASE WHEN was_truncated THEN
      format(
        'RÉSULTAT INCOMPLET : la requête renvoie plus de %s lignes, seules les %s premières sont ici. '
        'Ne pas présenter ce résultat comme exhaustif. Pour compter, utiliser count(*) ; '
        'pour tout parcourir, paginer avec ORDER BY et OFFSET.',
        row_limit, row_limit)
    ELSE
      'Résultat complet.'
    END
  );

EXCEPTION WHEN OTHERS THEN
  BEGIN
    INSERT INTO public.agent_query_audit_log (user_id, query_text, explanation, success, error_message, execution_ms)
    VALUES (p_user_id, query_text, p_explanation, false, SQLERRM,
            EXTRACT(MILLISECONDS FROM clock_timestamp() - start_ts)::int);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RAISE;
END;
$$;

COMMENT ON FUNCTION public.agent_sql_query(text, uuid, text) IS
  'Requête SELECT de l''agent. Renvoie { rows, row_count, limit, truncated, note } : '
  'la coupe à 100 lignes est explicite, pour qu''un résultat partiel ne puisse pas '
  'être pris pour un résultat exhaustif.';
