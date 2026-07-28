-- Retrait de la couche « autonomie » de l'agent.
--
-- Elle avait été construite pour une définition abstraite (« un système
-- capable d'atteindre un objectif avec une supervision limitée ») et non pour
-- un besoin constaté. À l'usage : deux écrans incompréhensibles exposant des
-- noms de fonctions, et des routines qui se contentaient d'écrire « synthèse à
-- produire » ou « opportunité en sommeil » là où l'application a déjà des
-- rappels. On retire.
--
-- ORDRE IMPÉRATIF : les triggers d'abord. Ils sont posés sur `media` et
-- `transcripts` et appellent une fonction qui lit `agent_objectives` :
-- supprimer la table en premier casserait tout upload de média.

DROP TRIGGER IF EXISTS wake_facilitateur_on_media ON public.media;
DROP TRIGGER IF EXISTS wake_contenus_on_transcript ON public.transcripts;
DROP FUNCTION IF EXISTS public.wake_agent_objective();

DROP VIEW IF EXISTS public.agent_daily_digest;

DROP TABLE IF EXISTS public.agent_action_log;
DROP TABLE IF EXISTS public.agent_objectives;
DROP TABLE IF EXISTS public.agent_autonomy_policy;
DROP TABLE IF EXISTS public.agent_memory;

-- Le cron `agent-objectives-tick` et le secret `AGENT_CRON_SECRET` ont été
-- posés directement en base, hors migration : les retirer côté Supabase
-- (`SELECT cron.unschedule('agent-objectives-tick');`).
