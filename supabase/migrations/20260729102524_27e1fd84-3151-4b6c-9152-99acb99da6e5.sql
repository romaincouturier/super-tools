-- Même cron que la migration précédente, fréquence resserrée. Même garde :
-- sans lui, le rejeu sur base vierge échoue sur un jobid qui n'existe qu'en
-- production (règle [042]).
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobid = 18) THEN
    PERFORM cron.alter_job(18, schedule => '*/2 5-9 * * *');
  END IF;
END
$do$;
