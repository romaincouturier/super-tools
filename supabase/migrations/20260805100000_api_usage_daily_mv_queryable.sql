-- Rendre la consommation d'API interrogeable par le connecteur MCP (query_database).
--
-- Contexte : l'onglet Monitoring → Usage lit `api_usage_events` via des RPC
-- gardées par `is_admin`. Ces RPC ne sont pas atteignables depuis le connecteur
-- MCP, qui passe par `agent_sql_query` (SELECT + allowlist de tables). La table
-- brute n'est volontairement PAS dans l'allowlist : elle contient `user_id`,
-- messages d'erreur et une ligne par appel, et `agent_sql_query` étant
-- SECURITY DEFINER sans garde `is_admin`, tout ce qui est marqué interrogeable
-- devient lisible par n'importe quel appelant de la fonction.
--
-- Solution : exposer une vue matérialisée AGRÉGÉE, sans aucune donnée
-- personnelle (pas de `user_id`, pas de message d'erreur, pas de ligne par
-- appel) — uniquement jour x provider x origine x opération x modèle x
-- déclencheur, avec les tokens et le coût sommés. Même lue par un tiers, elle
-- ne révèle que des agrégats de coût d'infrastructure.
--
-- Pourquoi une vue MATÉRIALISÉE et pas une vue simple : `agent_sql_query`
-- valide les tables en lisant `"Relation Name"` du plan EXPLAIN. Une vue simple
-- est aplatie vers sa table de base (`api_usage_events`) dans le plan, donc
-- l'enregistrer ne passerait pas l'allowlist. Une vue matérialisée est une
-- relation réelle : elle apparaît sous son propre nom dans le plan.

-- ── Vue matérialisée agrégée ─────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS public.api_usage_daily_mv AS
SELECT
  (e.created_at AT TIME ZONE 'Europe/Paris')::date        AS day,
  e.provider,
  e.origin,
  COALESCE(e.operation, '')                               AS operation,
  COALESCE(e.model, '')                                   AS model,
  e.trigger_source,
  count(*)::bigint                                        AS calls,
  count(*) FILTER (WHERE e.status <> 'success')::bigint   AS errors,
  COALESCE(sum(e.input_tokens), 0)::bigint                AS input_tokens,
  COALESCE(sum(e.output_tokens), 0)::bigint               AS output_tokens,
  COALESCE(sum(e.cache_read_tokens), 0)::bigint           AS cache_read_tokens,
  COALESCE(sum(e.cache_write_tokens), 0)::bigint          AS cache_write_tokens,
  COALESCE(sum(e.audio_seconds), 0)::numeric              AS audio_seconds,
  COALESCE(sum(e.cost_usd), 0)::numeric                   AS cost_usd,
  COALESCE(avg(e.duration_ms), 0)::numeric                AS avg_duration_ms
FROM public.api_usage_events e
GROUP BY 1, 2, 3, 4, 5, 6;

-- Index unique sur la clé d'agrégation : requis pour REFRESH ... CONCURRENTLY,
-- qui rafraîchit sans verrouiller les lecteurs.
CREATE UNIQUE INDEX IF NOT EXISTS api_usage_daily_mv_key
  ON public.api_usage_daily_mv (day, provider, origin, operation, model, trigger_source);

-- ── Enregistrement dans l'allowlist de l'agent ───────────────────────
-- `is_queryable = true` -> autorisée dans `agent_sql_query`. Les colonnes
-- décrites alimentent le prompt de schéma vu par l'agent.
INSERT INTO public.agent_schema_registry (table_name, description, columns, is_queryable, display_order)
VALUES (
  'api_usage_daily_mv',
  'Consommation quotidienne agrégée des APIs IA payantes (aucune donnée personnelle). '
  || 'Une ligne par jour x provider x origine (edge function) x opération x modèle x déclencheur. '
  || 'Rafraîchie chaque heure. Sert à répondre à "quelle fonction/quel modèle coûte le plus".',
  '[
    {"name":"day","type":"DATE","description":"Jour (Europe/Paris)"},
    {"name":"provider","type":"TEXT","description":"anthropic, openai, lovable, gemini, assemblyai"},
    {"name":"origin","type":"TEXT","description":"Nom de l edge function émettrice"},
    {"name":"operation","type":"TEXT","description":"Sous-opération, ex: chat, title, summary"},
    {"name":"model","type":"TEXT","description":"Identifiant du modèle appelé"},
    {"name":"trigger_source","type":"TEXT","description":"user, cron, webhook, trigger, unknown"},
    {"name":"calls","type":"BIGINT","description":"Nombre d appels"},
    {"name":"errors","type":"BIGINT","description":"Appels en échec"},
    {"name":"input_tokens","type":"BIGINT"},
    {"name":"output_tokens","type":"BIGINT"},
    {"name":"cache_read_tokens","type":"BIGINT"},
    {"name":"cache_write_tokens","type":"BIGINT"},
    {"name":"audio_seconds","type":"NUMERIC","description":"Durée audio facturée (transcription)"},
    {"name":"cost_usd","type":"NUMERIC","description":"Coût estimé en USD (Lovable = estimation tarifs Google)"},
    {"name":"avg_duration_ms","type":"NUMERIC"}
  ]'::jsonb,
  true,
  95
)
ON CONFLICT (table_name) DO UPDATE
  SET description  = EXCLUDED.description,
      columns      = EXCLUDED.columns,
      is_queryable = EXCLUDED.is_queryable,
      display_order = EXCLUDED.display_order,
      updated_at   = now();

-- ── Rafraîchissement horaire ─────────────────────────────────────────
-- CONCURRENTLY : ne verrouille pas les lecteurs (l'index unique ci-dessus le
-- permet). Garde anti-doublon sur l'unschedule, conforme au pattern du projet.
SELECT cron.unschedule('refresh-api-usage-daily-mv')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-api-usage-daily-mv');

SELECT cron.schedule(
  'refresh-api-usage-daily-mv',
  '20 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY public.api_usage_daily_mv;$$
);
