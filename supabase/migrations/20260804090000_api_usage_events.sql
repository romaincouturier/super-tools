-- Observabilité de la consommation des APIs payantes (Anthropic, OpenAI, AssemblyAI, Lovable…)
--
-- Chaque appel sortant facturé écrit une ligne ici. L'objectif est de pouvoir
-- répondre à « qui brûle les crédits » : quelle edge function (origin), quel
-- modèle, déclenché par quoi (utilisateur, cron, webhook, trigger DB).

CREATE TABLE IF NOT EXISTS public.api_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'anthropic' | 'openai' | 'assemblyai' | 'lovable' | 'gemini' | …
  provider text NOT NULL,
  -- nom de l'edge function qui a émis l'appel, ex: 'agent-chat'
  origin text NOT NULL,
  -- sous-opération dans la function, ex: 'chat', 'title', 'summary'
  operation text,
  model text,
  -- 'user' | 'cron' | 'webhook' | 'trigger' | 'unknown'
  trigger_source text NOT NULL DEFAULT 'unknown',
  user_id uuid,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cache_read_tokens integer NOT NULL DEFAULT 0,
  cache_write_tokens integer NOT NULL DEFAULT 0,
  -- transcription audio (AssemblyAI) : durée facturée
  audio_seconds numeric,
  cost_usd numeric(14, 6) NOT NULL DEFAULT 0,
  duration_ms integer,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_created_at
  ON public.api_usage_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_provider_time
  ON public.api_usage_events (provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_origin_time
  ON public.api_usage_events (origin, created_at DESC);

ALTER TABLE public.api_usage_events ENABLE ROW LEVEL SECURITY;

-- Écriture réservée au service_role (edge functions). Lecture admin uniquement :
-- les agrégats passent par les RPC SECURITY DEFINER ci-dessous.
DROP POLICY IF EXISTS "Admins can read api usage" ON public.api_usage_events;
CREATE POLICY "Admins can read api usage"
  ON public.api_usage_events FOR SELECT
  USING (public.is_admin(auth.uid()));

-- ── Agrégat journalier ───────────────────────────────────────────────
-- Une seule requête alimente tous les graphes de l'onglet Usage : la
-- granularité (jour x provider x origin x operation x model x déclencheur)
-- permet de reconstruire côté client n'importe quelle vue sans re-requêter.

CREATE OR REPLACE FUNCTION public.get_api_usage_daily(p_days integer DEFAULT 30)
RETURNS TABLE (
  day date,
  provider text,
  origin text,
  operation text,
  model text,
  trigger_source text,
  calls bigint,
  errors bigint,
  input_tokens bigint,
  output_tokens bigint,
  cache_read_tokens bigint,
  cache_write_tokens bigint,
  audio_seconds numeric,
  cost_usd numeric,
  avg_duration_ms numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (e.created_at AT TIME ZONE 'Europe/Paris')::date AS day,
    e.provider,
    e.origin,
    COALESCE(e.operation, '') AS operation,
    COALESCE(e.model, '') AS model,
    e.trigger_source,
    count(*)::bigint AS calls,
    count(*) FILTER (WHERE e.status <> 'success')::bigint AS errors,
    COALESCE(sum(e.input_tokens), 0)::bigint AS input_tokens,
    COALESCE(sum(e.output_tokens), 0)::bigint AS output_tokens,
    COALESCE(sum(e.cache_read_tokens), 0)::bigint AS cache_read_tokens,
    COALESCE(sum(e.cache_write_tokens), 0)::bigint AS cache_write_tokens,
    COALESCE(sum(e.audio_seconds), 0)::numeric AS audio_seconds,
    COALESCE(sum(e.cost_usd), 0)::numeric AS cost_usd,
    COALESCE(avg(e.duration_ms), 0)::numeric AS avg_duration_ms
  FROM public.api_usage_events e
  WHERE e.created_at > now() - make_interval(days => greatest(1, least(p_days, 365)))
  GROUP BY 1, 2, 3, 4, 5, 6;
$$;

GRANT EXECUTE ON FUNCTION public.get_api_usage_daily(integer) TO authenticated;

-- ── Top appels les plus coûteux ──────────────────────────────────────
-- Sert à identifier l'appel unitaire qui dérape (prompt trop gros, boucle
-- d'outils qui ne s'arrête pas) plutôt que le volume.

CREATE OR REPLACE FUNCTION public.get_api_usage_top_calls(
  p_days integer DEFAULT 30,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  provider text,
  origin text,
  operation text,
  model text,
  trigger_source text,
  input_tokens integer,
  output_tokens integer,
  cache_read_tokens integer,
  cost_usd numeric,
  duration_ms integer,
  status text,
  error_message text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.created_at, e.provider, e.origin, COALESCE(e.operation, ''),
         COALESCE(e.model, ''), e.trigger_source, e.input_tokens, e.output_tokens,
         e.cache_read_tokens, e.cost_usd, e.duration_ms, e.status, e.error_message
  FROM public.api_usage_events e
  WHERE e.created_at > now() - make_interval(days => greatest(1, least(p_days, 365)))
  ORDER BY e.cost_usd DESC
  LIMIT greatest(1, least(p_limit, 100));
$$;

GRANT EXECUTE ON FUNCTION public.get_api_usage_top_calls(integer, integer) TO authenticated;

-- ── Purge ────────────────────────────────────────────────────────────
-- Table à fort volume : on ne garde que 180 jours.

CREATE OR REPLACE FUNCTION public.purge_api_usage_events()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.api_usage_events WHERE created_at < now() - interval '180 days';
$$;

SELECT cron.unschedule('purge-api-usage-events')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-api-usage-events');

SELECT cron.schedule(
  'purge-api-usage-events',
  '45 3 * * 0',
  $$SELECT public.purge_api_usage_events();$$
);

-- ── Correctif feature_usage : lecture admin ──────────────────────────
-- La seule policy SELECT existante était `auth.uid() = user_id` : l'onglet
-- Usage n'affichait donc que les événements de l'utilisateur connecté, pas
-- l'usage réel du produit. On ajoute une lecture admin.

DROP POLICY IF EXISTS "Admins can read all usage events" ON public.feature_usage;
CREATE POLICY "Admins can read all usage events"
  ON public.feature_usage FOR SELECT
  USING (public.is_admin(auth.uid()));
