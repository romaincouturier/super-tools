
CREATE OR REPLACE FUNCTION public.reap_stuck_ticket_coding()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.support_tickets
  SET coding_status = 'error',
      coding_error = 'Aucun retour du workflow GitHub Actions après 30 min (queued). Vérifier https://github.com/romaincouturier/super-tools/actions'
  WHERE coding_status = 'queued'
    AND updated_at < now() - interval '30 minutes';

  UPDATE public.support_tickets
  SET coding_status = 'error',
      coding_error = 'Workflow GitHub Actions sans retour après 60 min (running). Vérifier https://github.com/romaincouturier/super-tools/actions'
  WHERE coding_status = 'running'
    AND updated_at < now() - interval '60 minutes';
$$;

SELECT cron.unschedule('reap-stuck-ticket-coding')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reap-stuck-ticket-coding');

SELECT cron.schedule(
  'reap-stuck-ticket-coding',
  '*/5 * * * *',
  $$SELECT public.reap_stuck_ticket_coding();$$
);

-- Rétro-application sur les tickets déjà bloqués
SELECT public.reap_stuck_ticket_coding();
