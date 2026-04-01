-- ============================================================
-- Schedule indexation queue processing every 2 minutes
-- ============================================================

SELECT cron.schedule(
  'process-indexation-queue',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/process-indexation-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Cleanup: purge processed queue items older than 7 days (daily at 3:00 AM)
SELECT cron.schedule(
  'cleanup-indexation-queue',
  '0 3 * * *',
  $$
  DELETE FROM public.indexation_queue
  WHERE processed_at IS NOT NULL
    AND processed_at < now() - interval '7 days';
  $$
);
