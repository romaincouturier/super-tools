-- ST-2026-0059: Auto-suppression des emails à valider
--
-- 1. Inserts the configurable retention setting (default 7 days).
-- 2. Schedules a daily cron at 03:00 UTC to call the Edge Function.

-- Default retention setting
INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES (
  'email_draft_pending_retention_days',
  '7',
  'Nombre de jours avant suppression automatique des brouillons d''emails en attente (statuts pending et rejected)'
)
ON CONFLICT (setting_key) DO NOTHING;

-- Daily cron: 03:00 UTC
SELECT cron.schedule(
  'cleanup-pending-email-drafts',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/cleanup-pending-email-drafts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  );
  $$
);
