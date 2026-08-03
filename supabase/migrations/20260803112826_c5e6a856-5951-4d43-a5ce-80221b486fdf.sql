-- Les agrégations GSC utilisent moins de 1 Mo de mémoire de tri (mesuré :
-- HashAggregate Memory Usage 913kB sur 90 jours de dimension 'page').
-- Réserver 96 Mo par appel multipliait la pression mémoire quand plusieurs
-- agrégations tournaient en parallèle et provoquait des statement timeouts.
ALTER FUNCTION public.gsc_aggregate(date, date, text, text, integer, text)
  SET work_mem = '32MB';
ALTER FUNCTION public.gsc_daily_totals(date, date, text)
  SET work_mem = '32MB';

-- Le plan est un Index Only Scan mais avec 11 802 heap fetches : la visibility
-- map est en retard sur les écritures de gsc-sync. Autovacuum plus agressif sur
-- cette table pour garder le scan réellement "index only".
ALTER TABLE public.gsc_metrics_daily SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_cost_delay = 0
);

ANALYZE public.gsc_metrics_daily;
