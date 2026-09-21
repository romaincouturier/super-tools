-- Veille — le score de fraîcheur devient une fonction de l'âge, et il est calculé
-- chaque nuit.
--
-- Constat : decay_watch_relevance() est définie depuis la création du module
-- (20260331100000) mais aucun cron ne l'appelle. Tous les contenus portent donc
-- encore leur score par défaut de 100, et le tri de la page Veille
-- (relevance_score DESC, created_at DESC) revient de fait à un tri par date.
--
-- La planifier telle quelle aurait été pire que de ne rien faire : la version
-- d'origine SOUSTRAIT l'âge à chaque passage, alors que l'âge, lui, ne cesse de
-- croître. Une exécution quotidienne retirait 0,5 le premier jour, 1,0 le
-- deuxième, 1,5 le troisième : tout retombait à zéro en une vingtaine de jours,
-- et deux exécutions le même jour décalaient encore le résultat.
--
-- Le score est donc recalculé, pas décrémenté : 100 au dépôt, -0,5 par jour
-- depuis la dernière mise à jour, plancher à 0 (200 jours). La fonction devient
-- idempotente — la rejouer dix fois dans la journée donne le même score —, ce
-- qui est l'invariant qu'exige un travail planifié.
--
-- Le cron est en SQL pur : aucun secret, il a donc sa place dans une migration
-- versionnée (règle [036]). Les deux crons de veille qui appellent une edge
-- function (watch-cluster-analysis, watch-weekly-digest) se posent en base, leur
-- SQL est dans docs/veille.md.

CREATE OR REPLACE FUNCTION public.decay_watch_relevance()
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE public.watch_items
  SET relevance_score = GREATEST(
        0,
        100 - (EXTRACT(EPOCH FROM (now() - updated_at)) / 86400.0) * 0.5
      );
$$;

-- La fonction n'est pas SECURITY DEFINER, mais PostgREST l'expose : personne
-- n'a besoin de la déclencher depuis l'application. Le cron tourne en postgres,
-- propriétaire, et n'est pas concerné par ces révocations.
REVOKE ALL ON FUNCTION public.decay_watch_relevance() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decay_watch_relevance() FROM anon;
REVOKE ALL ON FUNCTION public.decay_watch_relevance() FROM authenticated;

SELECT cron.unschedule('decay-watch-relevance')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'decay-watch-relevance');

SELECT cron.schedule(
  'decay-watch-relevance',
  '40 3 * * *',
  $$SELECT public.decay_watch_relevance();$$
);
