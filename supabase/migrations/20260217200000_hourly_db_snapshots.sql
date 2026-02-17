-- Allow multiple snapshots per day (hourly instead of daily)
ALTER TABLE public.db_size_snapshots DROP CONSTRAINT IF EXISTS db_size_snapshots_snapshot_date_key;

-- Schedule automatic hourly snapshots via pg_cron
SELECT cron.schedule(
  'hourly-db-size-snapshot',
  '0 * * * *',
  $$
  INSERT INTO public.db_size_snapshots (snapshot_date, total_size_bytes, table_sizes)
  SELECT
    CURRENT_DATE,
    (size_info->>'total_size_bytes')::bigint,
    size_info->'table_sizes'
  FROM (SELECT public.get_db_size()::json AS size_info) AS s
  $$
);
