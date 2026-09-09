-- 20260908090000_api_usage_by_task.sql
CREATE INDEX IF NOT EXISTS api_usage_events_task_id_idx
  ON public.api_usage_events ((metadata ->> 'task_id'))
  WHERE metadata ? 'task_id';

DROP FUNCTION IF EXISTS public.get_api_usage_by_task(integer, integer);

CREATE FUNCTION public.get_api_usage_by_task(
  p_days integer DEFAULT 30,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  task_id text,
  origin text,
  started_at timestamptz,
  calls integer,
  errors integer,
  input_tokens bigint,
  output_tokens bigint,
  cache_read_tokens bigint,
  cache_write_tokens bigint,
  cost_usd numeric,
  duration_ms bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs';
  END IF;

  RETURN QUERY
  SELECT (e.metadata ->> 'task_id')::text,
         max(e.origin)::text,
         min(e.created_at),
         count(*)::integer,
         count(*) FILTER (WHERE e.status = 'error')::integer,
         sum(e.input_tokens)::bigint,
         sum(e.output_tokens)::bigint,
         sum(e.cache_read_tokens)::bigint,
         sum(e.cache_write_tokens)::bigint,
         sum(e.cost_usd)::numeric,
         sum(coalesce(e.duration_ms, 0))::bigint
  FROM public.api_usage_events e
  WHERE e.created_at > now() - make_interval(days => greatest(1, least(p_days, 365)))
    AND e.metadata ? 'task_id'
  GROUP BY e.metadata ->> 'task_id'
  ORDER BY sum(e.cost_usd) DESC
  LIMIT greatest(1, least(p_limit, 100));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_api_usage_by_task(integer, integer) TO authenticated;

COMMENT ON FUNCTION public.get_api_usage_by_task(integer, integer) IS
  'Tâches agent les plus coûteuses sur la période : une ligne par task_id, tous appels du tour confondus. Admin uniquement.';