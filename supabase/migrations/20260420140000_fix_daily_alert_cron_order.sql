-- Ensure generate-daily-actions runs BEFORE the digest email so both
-- use the same DB snapshot: daily_actions generated first at 7:00 AM,
-- then process-logistics-reminders reads fresh data at 7:05 AM.

-- Reschedule generate-daily-actions from 7:05 → 7:00
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'generate-daily-actions'),
  schedule := '0 7 * * *'
);

-- Remove existing process-logistics-reminders job (no-op if not found)
SELECT cron.unschedule('process-logistics-reminders');

-- Re-register at 7:05 — vault is accessed at cron runtime, not at migration time
SELECT cron.schedule(
  'process-logistics-reminders',
  '5 7 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/process-logistics-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
