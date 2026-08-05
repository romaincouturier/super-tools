-- Double comptage des transcriptions AssemblyAI.
--
-- `pollAssemblyAIJob` est une LECTURE : un GET sur le transcript, gratuit.
-- AssemblyAI facture une fois, à la soumission du job. Or le log de
-- consommation était posé sur le poll : chaque relecture d'un job déjà terminé
-- réécrivait un événement facturé pour la durée complète de l'audio.
--
-- Le job est relu au moins deux fois en pratique — le webhook de fin ET le cron
-- `poll-drive-transcripts` interrogent le même identifiant — d'où des coûts
-- affichés gonflés d'un facteur variable.
--
-- Correctif : un identifiant externe porte l'unicité de l'événement facturé.
-- Un second log pour le même job est rejeté par l'index, silencieusement.

ALTER TABLE public.api_usage_events
  ADD COLUMN IF NOT EXISTS external_id text;

COMMENT ON COLUMN public.api_usage_events.external_id IS
  'Identifiant de l''unité facturée chez le provider (ex: transcript_id AssemblyAI). '
  'Garantit un seul événement de coût quand la ressource est relue plusieurs fois.';

-- Index partiel : seules les lignes portant un identifiant externe sont
-- contraintes. Les appels facturés à l''unité (Anthropic, OpenAI) n'en ont pas
-- et restent libres de se répéter — chaque appel y est réellement facturé.
CREATE UNIQUE INDEX IF NOT EXISTS api_usage_events_external_id_uniq
  ON public.api_usage_events (provider, external_id)
  WHERE external_id IS NOT NULL;

-- ── Rattrapage des lignes déjà écrites en double ─────────────────────
-- On ne peut pas reconstruire l'identifiant de job a posteriori : on déduplique
-- sur (provider, origin, operation, audio_seconds), qui identifie de fait un
-- transcript donné, en gardant la première occurrence.
DELETE FROM public.api_usage_events a
USING public.api_usage_events b
WHERE a.provider = 'assemblyai'
  AND b.provider = 'assemblyai'
  AND a.origin = b.origin
  AND COALESCE(a.operation, '') = COALESCE(b.operation, '')
  AND a.audio_seconds = b.audio_seconds
  AND a.audio_seconds > 0
  AND a.created_at > b.created_at;

-- ── Durée audio dans le top des appels ───────────────────────────────
-- Sans elle, une transcription s'affiche « 0 / 0 tokens » pour 0,90 $ : la
-- ligne paraît absurde alors que l'unité facturée est la minute d'audio.
-- Le type de retour change, donc DROP puis CREATE (CREATE OR REPLACE refuse).

DROP FUNCTION IF EXISTS public.get_api_usage_top_calls(integer, integer);

CREATE FUNCTION public.get_api_usage_top_calls(
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
  audio_seconds numeric,
  cost_usd numeric,
  duration_ms integer,
  status text,
  error_message text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs';
  END IF;

  RETURN QUERY
  SELECT e.id, e.created_at, e.provider, e.origin, COALESCE(e.operation, ''),
         COALESCE(e.model, ''), e.trigger_source, e.input_tokens, e.output_tokens,
         e.cache_read_tokens, COALESCE(e.audio_seconds, 0)::numeric, e.cost_usd,
         e.duration_ms, e.status, e.error_message
  FROM public.api_usage_events e
  WHERE e.created_at > now() - make_interval(days => greatest(1, least(p_days, 365)))
  ORDER BY e.cost_usd DESC
  LIMIT greatest(1, least(p_limit, 100));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_api_usage_top_calls(integer, integer) TO authenticated;
