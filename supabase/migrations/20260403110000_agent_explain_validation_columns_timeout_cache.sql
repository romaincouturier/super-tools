-- ============================================================
-- Agent hardening: EXPLAIN validation, column filtering,
-- statement timeout, token tracking, embedding cache
-- ============================================================

-- ============================================================
-- 1. Add hidden_columns to schema registry (column-level allowlist)
-- ============================================================
ALTER TABLE public.agent_schema_registry
  ADD COLUMN IF NOT EXISTS hidden_columns text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.agent_schema_registry.hidden_columns IS
  'Column names the agent is NOT allowed to read. Validated before query execution.';

-- ============================================================
-- 2. Add token tracking to agent_conversations
-- ============================================================
ALTER TABLE public.agent_conversations
  ADD COLUMN IF NOT EXISTS total_input_tokens int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_output_tokens int NOT NULL DEFAULT 0;

-- ============================================================
-- 3. Embedding cache table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agent_embedding_cache (
  query_hash text PRIMARY KEY,             -- SHA-256 of the normalized query text
  query_text text NOT NULL,                -- original text (for debugging)
  embedding jsonb NOT NULL,                -- the embedding vector as JSON array
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_embedding_cache_created ON public.agent_embedding_cache (created_at);

ALTER TABLE public.agent_embedding_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_embedding_cache_service" ON public.agent_embedding_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "agent_embedding_cache_select_auth" ON public.agent_embedding_cache
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "agent_embedding_cache_insert_auth" ON public.agent_embedding_cache
  FOR INSERT TO authenticated WITH CHECK (true);

-- Cleanup: remove cache entries older than 7 days (called by cron or manually)
CREATE OR REPLACE FUNCTION public.cleanup_agent_embedding_cache()
RETURNS int
LANGUAGE sql
AS $$
  WITH deleted AS (
    DELETE FROM public.agent_embedding_cache
    WHERE created_at < now() - interval '7 days'
    RETURNING 1
  )
  SELECT count(*)::int FROM deleted;
$$;

-- ============================================================
-- 4. Updated agent_sql_query with EXPLAIN validation,
--    column filtering, and statement timeout
-- ============================================================
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
  hidden_cols_map jsonb;  -- {"table_name": ["col1","col2"]}
  t text;
  col text;
  tbl_name text;
  tbl_hidden text[];
  row_cnt int;
  start_ts timestamptz;
  elapsed_ms int;
BEGIN
  start_ts := clock_timestamp();

  -- Strip trailing semicolons and whitespace
  clean_query := regexp_replace(trim(query_text), ';\s*$', '');
  -- Normalize: trim and lowercase for validation
  normalized := lower(clean_query);

  -- Only allow SELECT statements
  IF NOT (normalized LIKE 'select%' OR normalized LIKE 'with%') THEN
    INSERT INTO public.agent_query_audit_log (user_id, query_text, explanation, success, error_message, execution_ms)
    VALUES (p_user_id, query_text, p_explanation, false, 'Only SELECT queries are allowed',
            EXTRACT(MILLISECONDS FROM clock_timestamp() - start_ts)::int);
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;

  -- Block dangerous keywords (word boundaries to avoid matching column names like updated_at)
  IF normalized ~ '\m(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|execute)\M' THEN
    INSERT INTO public.agent_query_audit_log (user_id, query_text, explanation, success, error_message, execution_ms)
    VALUES (p_user_id, query_text, p_explanation, false, 'Write operations are not allowed',
            EXTRACT(MILLISECONDS FROM clock_timestamp() - start_ts)::int);
    RAISE EXCEPTION 'Write operations are not allowed';
  END IF;

  -- Block multiple statements
  IF clean_query ~ ';' THEN
    INSERT INTO public.agent_query_audit_log (user_id, query_text, explanation, success, error_message, execution_ms)
    VALUES (p_user_id, query_text, p_explanation, false, 'Multiple statements are not allowed',
            EXTRACT(MILLISECONDS FROM clock_timestamp() - start_ts)::int);
    RAISE EXCEPTION 'Multiple statements are not allowed';
  END IF;

  -- ── EXPLAIN-based table validation (AST-level) ──
  -- Use EXPLAIN to let PostgreSQL's own parser resolve all table references
  -- (CTEs, subqueries, views, etc.)
  BEGIN
    EXECUTE format('EXPLAIN (FORMAT JSON) %s', clean_query) INTO plan_json;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.agent_query_audit_log (user_id, query_text, explanation, success, error_message, execution_ms)
    VALUES (p_user_id, query_text, p_explanation, false, format('SQL parse error: %s', SQLERRM),
            EXTRACT(MILLISECONDS FROM clock_timestamp() - start_ts)::int);
    RAISE;
  END;

  -- Extract all "Relation Name" from the plan tree (recursive JSON extraction)
  SELECT array_agg(DISTINCT val)
  INTO plan_tables
  FROM (
    SELECT jsonb_path_query(plan_json, 'strict $.**.\"Relation Name\"')::text AS val
  ) sub
  WHERE val IS NOT NULL;

  -- Remove JSON quotes from extracted values
  IF plan_tables IS NOT NULL THEN
    plan_tables := array(SELECT trim(both '"' FROM unnest(plan_tables)));
  END IF;

  -- Load allowed tables
  allowed_tables := public.get_agent_allowed_tables();

  IF plan_tables IS NOT NULL THEN
    FOREACH t IN ARRAY plan_tables LOOP
      IF NOT (t = ANY(allowed_tables)) THEN
        INSERT INTO public.agent_query_audit_log (user_id, query_text, explanation, success, error_message, execution_ms)
        VALUES (p_user_id, query_text, p_explanation, false, format('Table not allowed: %s (detected via EXPLAIN)', t),
                EXTRACT(MILLISECONDS FROM clock_timestamp() - start_ts)::int);
        RAISE EXCEPTION 'Access denied: table "%" is not in the allowed list', t;
      END IF;
    END LOOP;
  END IF;

  -- ── Column-level filtering ──
  -- Load hidden columns map from registry
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
        -- Check if the column name appears in the query (word boundary match)
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

  -- ── Execute with timeout + read-only ──
  SET LOCAL statement_timeout = '10s';
  SET LOCAL transaction_read_only = true;
  EXECUTE format('SELECT jsonb_agg(row_to_json(sub)) FROM (SELECT * FROM (%s) _inner LIMIT 100) sub', clean_query) INTO result;

  result := COALESCE(result, '[]'::jsonb);

  -- Count rows for audit
  row_cnt := jsonb_array_length(result);
  elapsed_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - start_ts)::int;

  -- Log successful query
  INSERT INTO public.agent_query_audit_log (user_id, query_text, explanation, success, row_count, execution_ms)
  VALUES (p_user_id, query_text, p_explanation, true, row_cnt, elapsed_ms);

  RETURN result;

EXCEPTION WHEN OTHERS THEN
  -- Log error (unless already logged above via explicit INSERT)
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

-- ============================================================
-- 5. RPC to atomically increment token counters + update messages
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_agent_tokens(
  p_conversation_id uuid,
  p_input_tokens int,
  p_output_tokens int,
  p_messages jsonb
)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.agent_conversations
  SET
    messages = p_messages,
    total_input_tokens = total_input_tokens + p_input_tokens,
    total_output_tokens = total_output_tokens + p_output_tokens,
    updated_at = now()
  WHERE id = p_conversation_id;
$$;

-- ============================================================
-- 6. Cron: cleanup embedding cache weekly
-- ============================================================
SELECT cron.schedule(
  'cleanup-agent-embedding-cache',
  '0 3 * * 0',
  $$SELECT public.cleanup_agent_embedding_cache()$$
);
