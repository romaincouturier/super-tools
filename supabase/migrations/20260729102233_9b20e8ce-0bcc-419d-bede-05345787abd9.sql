-- Ajustement de la fréquence d'un cron existant, identifié par son jobid de
-- production. Le garde est indispensable : sur une base vierge ce job n'existe
-- pas, et cron.alter_job lève « Job 18 does not exist or you don't own it »,
-- ce qui casse le rejeu complet de l'historique (règle [042]).
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobid = 18) THEN
    PERFORM cron.alter_job(18, schedule => '*/5 5-9 * * *');
  END IF;
END
$do$;
