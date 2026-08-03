CREATE INDEX IF NOT EXISTS gsc_metrics_daily_agg_idx
  ON public.gsc_metrics_daily (dimension, search_type, date)
  INCLUDE (key_1, key_2, clicks, impressions, "position");

CREATE OR REPLACE FUNCTION public.gsc_aggregate(
  p_from date,
  p_to date,
  p_dimension text,
  p_search_type text DEFAULT 'web',
  p_limit integer DEFAULT 100,
  p_contains text DEFAULT NULL
)
RETURNS TABLE (
  key_1 text,
  key_2 text,
  clicks bigint,
  impressions bigint,
  ctr numeric,
  "position" numeric
)
LANGUAGE sql
STABLE
SET search_path = public
SET work_mem = '96MB'
SET statement_timeout = '60s'
AS $$
  SELECT
    m.key_1,
    m.key_2,
    sum(m.clicks)::bigint,
    sum(m.impressions)::bigint,
    (sum(m.clicks)::numeric / nullif(sum(m.impressions), 0))::numeric,
    (sum(m.position * m.impressions) / nullif(sum(m.impressions), 0))::numeric
  FROM public.gsc_metrics_daily m
  WHERE m.dimension = p_dimension
    AND m.search_type = coalesce(p_search_type, 'web')
    AND m.date BETWEEN p_from AND p_to
    AND (p_contains IS NULL OR m.key_1 ILIKE '%' || p_contains || '%' OR m.key_2 ILIKE '%' || p_contains || '%')
  GROUP BY m.key_1, m.key_2
  ORDER BY sum(m.impressions) DESC
  LIMIT greatest(1, least(coalesce(p_limit, 100), 5000));
$$;

CREATE OR REPLACE FUNCTION public.gsc_daily_totals(
  p_from date,
  p_to date,
  p_search_type text DEFAULT 'web'
)
RETURNS TABLE (
  date date,
  clicks bigint,
  impressions bigint,
  ctr numeric,
  "position" numeric
)
LANGUAGE sql
STABLE
SET search_path = public
SET work_mem = '96MB'
SET statement_timeout = '60s'
AS $$
  SELECT
    m.date,
    sum(m.clicks)::bigint,
    sum(m.impressions)::bigint,
    (sum(m.clicks)::numeric / nullif(sum(m.impressions), 0))::numeric,
    (sum(m.position * m.impressions) / nullif(sum(m.impressions), 0))::numeric
  FROM public.gsc_metrics_daily m
  WHERE m.dimension = 'date'
    AND m.search_type = coalesce(p_search_type, 'web')
    AND m.date BETWEEN p_from AND p_to
  GROUP BY m.date
  ORDER BY m.date;
$$;

GRANT EXECUTE ON FUNCTION public.gsc_aggregate(date, date, text, text, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsc_daily_totals(date, date, text) TO authenticated, service_role;

ANALYZE public.gsc_metrics_daily;