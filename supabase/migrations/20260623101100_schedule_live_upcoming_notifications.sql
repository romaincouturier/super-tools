-- ST-2026-0201 — Planifie l'envoi quotidien des notifications "Prochain live" (J-3).
-- S'execute tous les jours a 06:00 UTC. Le replay est gere par trigger (instantane),
-- seul le rappel J-3 necessite un cron.

SELECT cron.unschedule('process-live-upcoming-notifications')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-live-upcoming-notifications');

SELECT cron.schedule(
  'process-live-upcoming-notifications',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/process-live-upcoming-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
