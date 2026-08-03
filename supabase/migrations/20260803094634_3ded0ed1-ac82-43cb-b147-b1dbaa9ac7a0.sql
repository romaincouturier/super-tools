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
  WHERE m.dimension = 'total'
    AND m.search_type = coalesce(p_search_type, 'web')
    AND m.date BETWEEN p_from AND p_to
  GROUP BY m.date
  ORDER BY m.date;
$$;

GRANT EXECUTE ON FUNCTION public.gsc_daily_totals(date, date, text) TO authenticated, service_role;