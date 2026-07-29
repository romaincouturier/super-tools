-- Historisation SEO / audience — Google Search Console et WP-Statistics
--
-- Constat : les deux intégrations étaient des proxys live, sans aucun
-- stockage. Conséquences : (1) le serveur MCP n'avait accès à AUCUNE donnée
-- d'audience — Claude répondait « Google Search Console n'est pas accessible
-- d'ici » ; (2) aucune comparaison de période possible ; (3) perte définitive
-- des données au-delà des 16 mois de rétention de Search Console ; (4) la
-- seule mesure de trafic disponible en base était le champ figé
-- wp_articles.views, écrasé à chaque import.
--
-- Ces tables sont alimentées par les crons gsc-sync et wp-statistics-sync.
-- Elles sont déclarées dans agent_schema_registry : l'agent SQL et le
-- connecteur MCP peuvent donc les interroger directement.

-- ── Faits Search Console ────────────────────────────────────
-- Table unique volontairement générique : une ligne = une combinaison
-- (jour, dimension, valeur, type de recherche). Évite sept tables jumelles
-- et un code de synchronisation dupliqué sept fois.
CREATE TABLE IF NOT EXISTS public.gsc_metrics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_url text NOT NULL,
  date date NOT NULL,
  dimension text NOT NULL,
  key_1 text NOT NULL DEFAULT '',       -- requête, URL, pays, appareil, apparence
  key_2 text NOT NULL DEFAULT '',       -- requête quand dimension = page_query
  search_type text NOT NULL DEFAULT 'web',
  clicks integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  ctr numeric(9,6) NOT NULL DEFAULT 0,
  position numeric(7,2) NOT NULL DEFAULT 0,
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gsc_metrics_daily_dimension_check
    CHECK (dimension IN ('total', 'query', 'page', 'country', 'device', 'appearance', 'page_query')),
  CONSTRAINT gsc_metrics_daily_search_type_check
    CHECK (search_type IN ('web', 'image', 'video', 'news', 'googleNews', 'discover'))
);

-- Clé de rafraîchissement : la synchro purge puis réinsère un (jour, dimension,
-- type) complet, ce qui la rend idempotente sans contrainte d'unicité sur des
-- clés textuelles de longueur libre (URL).
CREATE INDEX IF NOT EXISTS gsc_metrics_daily_slice_idx
  ON public.gsc_metrics_daily (site_url, date, dimension, search_type);
CREATE INDEX IF NOT EXISTS gsc_metrics_daily_dim_date_idx
  ON public.gsc_metrics_daily (dimension, date DESC);
CREATE INDEX IF NOT EXISTS gsc_metrics_daily_key_idx
  ON public.gsc_metrics_daily (dimension, key_1 text_pattern_ops);

COMMENT ON TABLE public.gsc_metrics_daily IS
  'Métriques Google Search Console jour par jour. dimension : total (site entier), query, page, country, device, appearance (résultats enrichis), page_query (croisement page x requête). key_1 porte la valeur de la dimension, key_2 la requête pour page_query.';

-- ── État d'indexation par URL (URL Inspection API) ──────────
CREATE TABLE IF NOT EXISTS public.gsc_url_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_url text NOT NULL,
  url text NOT NULL,
  verdict text,                          -- PASS / PARTIAL / FAIL / NEUTRAL
  coverage_state text,                   -- « Submitted and indexed », « Crawled - currently not indexed »…
  indexing_state text,                   -- INDEXING_ALLOWED / BLOCKED_BY_META_TAG…
  robots_txt_state text,
  page_fetch_state text,
  crawled_as text,
  google_canonical text,
  user_canonical text,
  last_crawl_time timestamptz,
  sitemaps text[] NOT NULL DEFAULT '{}',
  referring_urls text[] NOT NULL DEFAULT '{}',
  rich_results_verdict text,
  rich_result_types text[] NOT NULL DEFAULT '{}',
  rich_result_issues jsonb,
  error text,
  inspected_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS gsc_url_inspections_url_key
  ON public.gsc_url_inspections (site_url, url);
CREATE INDEX IF NOT EXISTS gsc_url_inspections_oldest_idx
  ON public.gsc_url_inspections (inspected_at);

COMMENT ON TABLE public.gsc_url_inspections IS
  'Résultat de l''API URL Inspection pour chaque URL du corpus : indexée ou non, dernière exploration, canonique retenue par Google, résultats enrichis détectés. Quota Google : 2000 URL par jour, le cron balaie donc le corpus par lots.';

-- ── Sitemaps ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gsc_sitemaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_url text NOT NULL,
  path text NOT NULL,
  type text,
  last_submitted timestamptz,
  last_downloaded timestamptz,
  is_pending boolean NOT NULL DEFAULT false,
  is_sitemaps_index boolean NOT NULL DEFAULT false,
  warnings bigint NOT NULL DEFAULT 0,
  errors bigint NOT NULL DEFAULT 0,
  contents jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS gsc_sitemaps_path_key
  ON public.gsc_sitemaps (site_url, path);

COMMENT ON TABLE public.gsc_sitemaps IS
  'Sitemaps déclarés dans Search Console : dernière soumission, dernière lecture par Google, avertissements et erreurs.';

-- ── Trafic web WP-Statistics ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wp_traffic_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  scope text NOT NULL,
  key text NOT NULL DEFAULT '',
  label text,
  views integer NOT NULL DEFAULT 0,
  visitors integer NOT NULL DEFAULT 0,
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wp_traffic_daily_scope_check
    CHECK (scope IN ('total', 'page', 'referrer', 'search_engine', 'ai_referrer'))
);

CREATE INDEX IF NOT EXISTS wp_traffic_daily_slice_idx
  ON public.wp_traffic_daily (date, scope);
CREATE INDEX IF NOT EXISTS wp_traffic_daily_key_idx
  ON public.wp_traffic_daily (scope, key text_pattern_ops);

COMMENT ON TABLE public.wp_traffic_daily IS
  'Instantané quotidien du trafic WP-Statistics. scope : total, page (vues par URL), referrer (sites référents), search_engine (moteurs), ai_referrer (ChatGPT, Perplexity, Gemini, Copilot… : la seule mesure GEO réellement disponible).';

-- ── RLS : lecture pour les utilisateurs connectés, écriture service_role ──
ALTER TABLE public.gsc_metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsc_url_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsc_sitemaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wp_traffic_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read gsc_metrics_daily" ON public.gsc_metrics_daily;
CREATE POLICY "Authenticated read gsc_metrics_daily" ON public.gsc_metrics_daily
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated read gsc_url_inspections" ON public.gsc_url_inspections;
CREATE POLICY "Authenticated read gsc_url_inspections" ON public.gsc_url_inspections
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated read gsc_sitemaps" ON public.gsc_sitemaps;
CREATE POLICY "Authenticated read gsc_sitemaps" ON public.gsc_sitemaps
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated read wp_traffic_daily" ON public.wp_traffic_daily;
CREATE POLICY "Authenticated read wp_traffic_daily" ON public.wp_traffic_daily
  FOR SELECT TO authenticated USING (true);

-- ── Purge : le croisement page x requête est le seul volume à risque ──
-- (jusqu'à 500 lignes par jour). Le reste est conservé indéfiniment, c'est
-- précisément l'intérêt de l'historisation face aux 16 mois de Google.
CREATE OR REPLACE FUNCTION public.purge_seo_history()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.gsc_metrics_daily
   WHERE dimension = 'page_query' AND date < current_date - 180;
  DELETE FROM public.wp_traffic_daily
   WHERE scope <> 'total' AND date < current_date - 730;
$$;

COMMENT ON FUNCTION public.purge_seo_history() IS
  'Purge des seules séries à fort volume : croisement page x requête au-delà de 180 jours, détail WP-Statistics au-delà de 2 ans.';

-- ── Allowlist agent SQL / connecteur MCP ────────────────────
INSERT INTO public.agent_schema_registry (table_name, description, display_order) VALUES
  ('gsc_metrics_daily',   'Google Search Console jour par jour (clics, impressions, CTR, position). dimension : total, query, page, country, device, appearance, page_query ; key_1 = valeur de la dimension, key_2 = requête pour page_query', 160),
  ('gsc_url_inspections', 'État d''indexation Google de chaque URL (indexée ou non, dernière exploration, canonique retenue, résultats enrichis)', 161),
  ('gsc_sitemaps',        'Sitemaps déclarés dans Search Console et leurs erreurs', 162),
  ('wp_traffic_daily',    'Trafic WP-Statistics jour par jour : total, vues par page, référents, moteurs de recherche, référents IA (ChatGPT, Perplexity…)', 163)
ON CONFLICT (table_name) DO NOTHING;

-- ── Crons ───────────────────────────────────────────────────
-- Règle [036] : les crons qui appellent une edge function sont planifiés
-- directement en base avec leur secret inline, jamais dans une migration
-- versionnée. Le SQL à exécuter (gsc-sync metrics/inspect/sitemaps et
-- wp-statistics-sync) est documenté dans docs/seo-analytics.md.
-- Seule la purge, qui n'appelle aucune fonction et ne porte aucun secret,
-- est planifiée ici.

SELECT cron.unschedule('purge-seo-history')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-seo-history');

SELECT cron.schedule(
  'purge-seo-history',
  '30 5 * * 0',
  $$SELECT public.purge_seo_history();$$
);

-- ── Agrégations SEO (RPC) ───────────────────────────────────
-- Le client PostgREST ne sait pas faire de GROUP BY : les agrégations vivent
-- ici, et servent à la fois l'UI (gsc-statistics) et le connecteur MCP.

-- Rapproche les URL Search Console des URL WordPress : protocole, www,
-- paramètres et slash final diffèrent systématiquement entre les deux sources.
CREATE OR REPLACE FUNCTION public.normalize_url(u text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(coalesce(u, ''), '\?.*$', ''),
        '^https?://', ''),
      '^www\.', ''),
    '/+$', '')
  );
$$;

-- Chemin seul d'une URL. WP-Statistics renvoie des URI (« /mon-article/ »)
-- là où Search Console et WordPress renvoient des URL complètes : le
-- rapprochement des vues se fait donc sur le chemin.
CREATE OR REPLACE FUNCTION public.url_path(u text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT '/' || btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(coalesce(u, '')), '^https?://[^/]*', ''),
      '\?.*$', ''),
    '^/+|/+$', '', 'g'),
  '/');
$$;

-- Agrégation d'une dimension sur une période (position = moyenne pondérée
-- par les impressions, comme dans l'interface Search Console).
CREATE OR REPLACE FUNCTION public.gsc_aggregate(
  p_from date,
  p_to date,
  p_dimension text,
  p_search_type text DEFAULT 'web',
  p_limit integer DEFAULT 100,
  p_contains text DEFAULT NULL
)
RETURNS TABLE (
  key_1 text,
  key_2 text,
  clicks bigint,
  impressions bigint,
  ctr numeric,
  "position" numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    m.key_1,
    m.key_2,
    sum(m.clicks)::bigint,
    sum(m.impressions)::bigint,
    (sum(m.clicks)::numeric / nullif(sum(m.impressions), 0))::numeric,
    (sum(m.position * m.impressions) / nullif(sum(m.impressions), 0))::numeric
  FROM public.gsc_metrics_daily m
  WHERE m.dimension = p_dimension
    AND m.search_type = coalesce(p_search_type, 'web')
    AND m.date BETWEEN p_from AND p_to
    AND (p_contains IS NULL OR m.key_1 ILIKE '%' || p_contains || '%' OR m.key_2 ILIKE '%' || p_contains || '%')
  GROUP BY m.key_1, m.key_2
  ORDER BY sum(m.impressions) DESC
  LIMIT greatest(1, least(coalesce(p_limit, 100), 5000));
$$;

-- Série journalière du site entier.
CREATE OR REPLACE FUNCTION public.gsc_daily_totals(
  p_from date,
  p_to date,
  p_search_type text DEFAULT 'web'
)
RETURNS TABLE (
  date date,
  clicks bigint,
  impressions bigint,
  ctr numeric,
  "position" numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    m.date,
    sum(m.clicks)::bigint,
    sum(m.impressions)::bigint,
    (sum(m.clicks)::numeric / nullif(sum(m.impressions), 0))::numeric,
    (sum(m.position * m.impressions) / nullif(sum(m.impressions), 0))::numeric
  FROM public.gsc_metrics_daily m
  WHERE m.dimension = 'total'
    AND m.search_type = coalesce(p_search_type, 'web')
    AND m.date BETWEEN p_from AND p_to
  GROUP BY m.date
  ORDER BY m.date;
$$;

-- Croisement contenus x audience : un article, ses vues WordPress, sa
-- performance Search Console et son état d'indexation.
CREATE OR REPLACE FUNCTION public.seo_content_performance(
  p_from date,
  p_to date,
  p_limit integer DEFAULT 50,
  p_category text DEFAULT NULL
)
RETURNS TABLE (
  article_id uuid,
  wp_id bigint,
  title text,
  url text,
  category text,
  published_at timestamptz,
  modified_at timestamptz,
  lifetime_views integer,
  period_views bigint,
  clicks bigint,
  impressions bigint,
  ctr numeric,
  "position" numeric,
  coverage_state text,
  index_verdict text,
  last_crawl_time timestamptz,
  has_excerpt boolean
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH pages AS (
    SELECT
      public.normalize_url(m.key_1) AS nurl,
      sum(m.clicks)::bigint AS clicks,
      sum(m.impressions)::bigint AS impressions,
      (sum(m.position * m.impressions) / nullif(sum(m.impressions), 0))::numeric AS position
    FROM public.gsc_metrics_daily m
    WHERE m.dimension = 'page' AND m.search_type = 'web' AND m.date BETWEEN p_from AND p_to
    GROUP BY 1
  ),
  views AS (
    SELECT public.url_path(w.key) AS upath, sum(w.views)::bigint AS views
    FROM public.wp_traffic_daily w
    WHERE w.scope = 'page' AND w.date BETWEEN p_from AND p_to
    GROUP BY 1
  )
  SELECT
    a.id,
    a.wp_id,
    a.title,
    a.url,
    a.category,
    a.published_at,
    a.modified_at,
    a.views,
    coalesce(v.views, 0),
    coalesce(p.clicks, 0),
    coalesce(p.impressions, 0),
    (coalesce(p.clicks, 0)::numeric / nullif(p.impressions, 0))::numeric,
    p.position,
    i.coverage_state,
    i.verdict,
    i.last_crawl_time,
    coalesce(length(btrim(coalesce(a.excerpt, ''))) > 0, false)
  FROM public.wp_articles a
  LEFT JOIN pages p ON p.nurl = public.normalize_url(a.url)
  LEFT JOIN views v ON v.upath = public.url_path(a.url)
  LEFT JOIN public.gsc_url_inspections i ON public.normalize_url(i.url) = public.normalize_url(a.url)
  WHERE a.status = 'publish'
    AND (p_category IS NULL OR a.category = p_category)
  ORDER BY coalesce(p.impressions, 0) DESC, coalesce(v.views, 0) DESC, a.views DESC NULLS LAST
  LIMIT greatest(1, least(coalesce(p_limit, 50), 500));
$$;

-- Cannibalisation : une même requête servie par plusieurs pages.
CREATE OR REPLACE FUNCTION public.seo_cannibalisation(
  p_from date,
  p_to date,
  p_min_impressions integer DEFAULT 50,
  p_limit integer DEFAULT 30
)
RETURNS TABLE (
  query text,
  page_count integer,
  impressions bigint,
  clicks bigint,
  best_position numeric,
  pages text[]
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH pq AS (
    SELECT
      m.key_2 AS query,
      m.key_1 AS page,
      sum(m.clicks)::bigint AS clicks,
      sum(m.impressions)::bigint AS impressions,
      (sum(m.position * m.impressions) / nullif(sum(m.impressions), 0))::numeric AS position
    FROM public.gsc_metrics_daily m
    WHERE m.dimension = 'page_query' AND m.date BETWEEN p_from AND p_to
    GROUP BY 1, 2
  )
  SELECT
    pq.query,
    count(*)::integer,
    sum(pq.impressions)::bigint,
    sum(pq.clicks)::bigint,
    min(pq.position),
    (array_agg(pq.page ORDER BY pq.impressions DESC))[1:5]
  FROM pq
  WHERE pq.query <> ''
  GROUP BY pq.query
  HAVING count(*) > 1 AND sum(pq.impressions) >= coalesce(p_min_impressions, 50)
  ORDER BY sum(pq.impressions) DESC
  LIMIT greatest(1, least(coalesce(p_limit, 30), 200));
$$;

-- Requêtes qui amènent une page donnée (drill-down d'un article).
CREATE OR REPLACE FUNCTION public.seo_queries_for_page(
  p_from date,
  p_to date,
  p_page text,
  p_limit integer DEFAULT 15
)
RETURNS TABLE (
  query text,
  clicks bigint,
  impressions bigint,
  ctr numeric,
  "position" numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    m.key_2,
    sum(m.clicks)::bigint,
    sum(m.impressions)::bigint,
    (sum(m.clicks)::numeric / nullif(sum(m.impressions), 0))::numeric,
    (sum(m.position * m.impressions) / nullif(sum(m.impressions), 0))::numeric
  FROM public.gsc_metrics_daily m
  WHERE m.dimension = 'page_query'
    AND m.date BETWEEN p_from AND p_to
    AND public.normalize_url(m.key_1) = public.normalize_url(p_page)
  GROUP BY m.key_2
  ORDER BY sum(m.impressions) DESC
  LIMIT greatest(1, least(coalesce(p_limit, 15), 100));
$$;

GRANT EXECUTE ON FUNCTION public.gsc_aggregate(date, date, text, text, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsc_daily_totals(date, date, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.seo_content_performance(date, date, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.seo_cannibalisation(date, date, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.seo_queries_for_page(date, date, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.normalize_url(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.url_path(text) TO authenticated, service_role;
