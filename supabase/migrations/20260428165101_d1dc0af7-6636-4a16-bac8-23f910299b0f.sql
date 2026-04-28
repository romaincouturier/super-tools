
-- 1) Fix the broken cron: replace Vault-based secrets (which are empty) with inline values, like all other crons in this project
SELECT cron.unschedule('process-logistics-reminders');

SELECT cron.schedule(
  'process-logistics-reminders',
  '5 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://yewffntzgrdgztrwtava.supabase.co/functions/v1/process-logistics-reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlld2ZmbnR6Z3JkZ3p0cnd0YXZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4ODcxNDUsImV4cCI6MjA4MzQ2MzE0NX0.Gugre6DaysctfwgBEIg_OQlgngDJqIl1l6ulwCUfgJE"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 2) Cron failure monitoring: surface any failed cron run from the last 24h
CREATE OR REPLACE FUNCTION public.monitor_cron_failures()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  failure_count int;
  failures jsonb;
  payload jsonb;
BEGIN
  SELECT COUNT(*), jsonb_agg(jsonb_build_object(
    'jobname', j.jobname,
    'status', jrd.status,
    'start_time', jrd.start_time,
    'message', LEFT(jrd.return_message, 500)
  ))
  INTO failure_count, failures
  FROM cron.job_run_details jrd
  JOIN cron.job j ON j.jobid = jrd.jobid
  WHERE jrd.start_time > now() - interval '24 hours'
    AND jrd.status <> 'succeeded';

  IF failure_count > 0 THEN
    payload := jsonb_build_object(
      'subject', '[SuperTools] ' || failure_count || ' échec(s) cron dans les 24h',
      'failures', failures
    );
    PERFORM net.http_post(
      url := 'https://yewffntzgrdgztrwtava.supabase.co/functions/v1/alert-form-error',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlld2ZmbnR6Z3JkZ3p0cnd0YXZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4ODcxNDUsImV4cCI6MjA4MzQ2MzE0NX0.Gugre6DaysctfwgBEIg_OQlgngDJqIl1l6ulwCUfgJE"}'::jsonb,
      body := payload
    );
  END IF;

  RETURN jsonb_build_object('failure_count', failure_count, 'sent', failure_count > 0);
END;
$$;

-- 3) Schedule the monitor every day at 08:00 Paris (06:00 UTC, adjusted by adjust_cron_timezones at DST changes)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monitor-cron-failures-daily') THEN
    PERFORM cron.unschedule('monitor-cron-failures-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'monitor-cron-failures-daily',
  '0 6 * * *',
  $$ SELECT public.monitor_cron_failures(); $$
);
