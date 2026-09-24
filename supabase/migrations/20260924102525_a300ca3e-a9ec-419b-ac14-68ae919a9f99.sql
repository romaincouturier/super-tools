CREATE OR REPLACE FUNCTION public.get_cron_status()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  WITH recent AS (
    SELECT
      d.jobid,
      d.status,
      d.start_time,
      d.end_time,
      LEFT(d.return_message, 500) AS return_message,
      row_number() OVER (PARTITION BY d.jobid ORDER BY d.start_time DESC) AS rn
    FROM cron.job_run_details d
    WHERE d.start_time > now() - interval '14 days'
  ),
  runs AS (
    SELECT
      jobid,
      json_agg(
        json_build_object(
          'status', status,
          'start_time', start_time,
          'end_time', end_time,
          'return_message', return_message
        ) ORDER BY start_time DESC
      ) AS recent_runs
    FROM recent
    WHERE rn <= 10
    GROUP BY jobid
  )
  SELECT json_build_object(
    'jobs', COALESCE((
      SELECT json_agg(
        json_build_object(
          'jobid', j.jobid,
          'jobname', j.jobname,
          'schedule', j.schedule,
          'command', LEFT(j.command, 200),
          'active', j.active,
          'last_run', r.recent_runs -> 0,
          'recent_runs', COALESCE(r.recent_runs, '[]'::json)
        ) ORDER BY j.jobname
      )
      FROM cron.job j
      LEFT JOIN runs r ON r.jobid = j.jobid
    ), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;

DELETE FROM cron.job_run_details WHERE end_time < now() - interval '14 days';

SELECT cron.unschedule('purge-cron-run-history')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-cron-run-history');

SELECT cron.schedule(
  'purge-cron-run-history',
  '15 4 * * *',
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '14 days';$$
);