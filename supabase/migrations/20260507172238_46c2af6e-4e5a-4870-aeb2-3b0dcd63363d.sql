SELECT cron.unschedule('process-logistics-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-logistics-reminders');