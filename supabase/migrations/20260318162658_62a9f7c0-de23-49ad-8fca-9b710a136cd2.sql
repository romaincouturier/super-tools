SELECT cron.unschedule('process-live-reminders-backup-1')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-live-reminders-backup-1');
SELECT cron.unschedule('process-live-reminders-backup-2')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-live-reminders-backup-2');