-- Boucle d'amélioration du moteur éditorial (chantiers 1+2+3).
--
-- 1. Motifs de refus structurés : rend les refus agrégeables (dashboard
--    d'alignement) et exploitables par le moteur.
-- 2. Mémoire des décisions : le template du prompt reçoit une variable
--    {{decisions_recentes}} (derniers refus avec motifs + dernières
--    acceptations) pour que le moteur imite les préférences d'Emmanuelle.
--
-- NOTE (règle [036]) : le cron du digest hebdo (editorial-weekly-digest,
-- lundi 07:00) n'est PAS planifié ici. Il doit être créé directement en
-- base avec le header x-cron-secret inline (même secret EDITORIAL_CRON_SECRET
-- que les autres crons éditoriaux).

ALTER TABLE public.editorial_recommendations
  ADD COLUMN IF NOT EXISTS decision_reason text CHECK (decision_reason IS NULL OR decision_reason IN (
    'trop_generique', 'deja_couvert', 'mauvaise_cible', 'sujet_sensible', 'pas_le_moment', 'autre'
  ));

-- Détection des pannes silencieuses de crons éditoriaux (leçon de la règle
-- [036] : le cron backfill a échoué pendant des jours sans aucune alerte).
-- SECURITY DEFINER : cron.job_run_details n'est pas exposé via PostgREST.
CREATE OR REPLACE FUNCTION public.editorial_cron_failures_last_week()
RETURNS TABLE (jobname text, failed_runs bigint, last_error text)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT j.jobname::text, count(*) AS failed_runs, max(d.return_message) AS last_error
  FROM cron.job_run_details d
  JOIN cron.job j ON j.jobid = d.jobid
  WHERE j.jobname IN ('editorial-backfill', 'editorial-engine-weekly', 'editorial-weekly-digest')
    AND d.status = 'failed'
    AND d.start_time > now() - interval '7 days'
  GROUP BY j.jobname;
$$;

REVOKE ALL ON FUNCTION public.editorial_cron_failures_last_week() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.editorial_cron_failures_last_week() TO service_role;

-- Injection des arbitrages récents dans le template (idempotent, préserve
-- les personnalisations : ne touche pas un template déjà porteur de la variable).
UPDATE public.transcript_ai_prompts
SET user_prompt_template = replace(
  user_prompt_template,
  'Produis la fiche de recommandation éditoriale JSON.',
  '── ARBITRAGES HUMAINS RÉCENTS (imiter ces préférences : ne pas reproposer ce qui a été refusé, s''inspirer de ce qui a été accepté) ──
{{decisions_recentes}}

Produis la fiche de recommandation éditoriale JSON.'
)
WHERE kind = 'editorial_engine'
  AND user_prompt_template NOT LIKE '%decisions_recentes%';
