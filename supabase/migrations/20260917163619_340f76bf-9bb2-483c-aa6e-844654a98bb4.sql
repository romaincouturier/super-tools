-- Le job 82 n'existe que sur l'instance de production. Sur une base neuve,
-- cron.alter_job lève « Job 82 does not exist » et arrête le déploiement :
-- c'est ce qui met le CI au rouge depuis le 17/09, sur main comme sur toute
-- PR touchant les migrations. La garde rend l'instruction rejouable (règle
-- [042d] d'IMPROVEMENTS.md).
SELECT cron.alter_job(82, schedule => '15 * * * *')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobid = 82);
