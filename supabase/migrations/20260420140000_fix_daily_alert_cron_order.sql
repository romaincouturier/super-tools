-- Ensure generate-daily-actions runs BEFORE the digest email so both
-- use the same DB snapshot: daily_actions generated first at 7:00 AM,
-- then process-logistics-reminders reads fresh data at 7:05 AM.

-- Reschedule generate-daily-actions from 7:05 → 7:00
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'generate-daily-actions'),
  schedule := '0 7 * * *'
);

-- Register (or update) process-logistics-reminders at 7:05 AM.
-- Uses string concatenation to build the cron command — avoids nested dollar-quoting.
DO $body$
DECLARE
  v_url  text;
  v_key  text;
  v_cmd  text;
  v_jobid bigint;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL';
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';

  v_cmd := 'SELECT net.http_post('
    || 'url := ' || quote_literal(v_url || '/functions/v1/process-logistics-reminders') || ', '
    || 'headers := jsonb_build_object(''Content-Type'',''application/json'',''Authorization'',''Bearer ' || v_key || '''), '
    || 'body := ''{}''::jsonb) AS request_id;';

  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'process-logistics-reminders';

  IF v_jobid IS NOT NULL THEN
    PERFORM cron.alter_job(v_jobid, schedule := '5 7 * * *');
  ELSE
    PERFORM cron.schedule('process-logistics-reminders', '5 7 * * *', v_cmd);
  END IF;
END
$body$;
