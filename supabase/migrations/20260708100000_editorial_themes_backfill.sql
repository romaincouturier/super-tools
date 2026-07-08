-- ST-2026-0225 / ST-2026-0226 — Clustering thématique + backfill de qualification.
--
-- Constat prod : 162 transcripts ready sans fiche éditoriale (l'analyse auto ne
-- couvre que les nouveaux transcripts) et wp_articles vide au premier passage
-- du moteur. Le moteur ne voyait donc presque rien.
--
-- 1. Backfill : cron toutes les 10 min qui qualifie les transcripts en attente
--    par lots (edge function editorial-backfill). Sert aussi de filet de
--    rattrapage permanent si une analyse auto échoue.
-- 2. Clustering : les signaux proches sont regroupés en thèmes
--    (editorial_themes) ; le moteur produit UNE recommandation par thème,
--    nourrie par toutes ses sources, au lieu d'une par transcript.

-- ── Thèmes éditoriaux ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.editorial_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL DEFAULT '',
  univers text,
  embedding extensions.vector(1536),
  signal_count integer NOT NULL DEFAULT 0,
  recommendation_id uuid REFERENCES public.editorial_recommendations(id) ON DELETE SET NULL,
  last_reinforced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS editorial_themes_embedding_idx
  ON public.editorial_themes USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS editorial_themes_reco_idx
  ON public.editorial_themes (recommendation_id);

-- Sources rattachées à un thème (transcript ou formation). Le snapshot
-- signal_text évite de recomposer le signal au moment de la recommandation.
CREATE TABLE IF NOT EXISTS public.editorial_theme_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id uuid NOT NULL REFERENCES public.editorial_themes(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('transcript', 'feedback')),
  source_id uuid NOT NULL,
  label text NOT NULL DEFAULT '',
  signal_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id)
);

CREATE INDEX IF NOT EXISTS editorial_theme_sources_theme_idx
  ON public.editorial_theme_sources (theme_id);

CREATE OR REPLACE FUNCTION public.match_editorial_themes(
  query_embedding extensions.vector(1536),
  match_count int DEFAULT 3
)
RETURNS TABLE (id uuid, label text, univers text, signal_count integer, similarity float)
LANGUAGE sql STABLE AS $$
  SELECT t.id, t.label, t.univers, t.signal_count,
         1 - (t.embedding <=> query_embedding) AS similarity
  FROM public.editorial_themes t
  WHERE t.embedding IS NOT NULL
  ORDER BY t.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_editorial_themes(extensions.vector, int) TO authenticated;

ALTER TABLE public.editorial_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editorial_theme_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage editorial_themes" ON public.editorial_themes
  FOR ALL TO authenticated
  USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "Staff manage editorial_theme_sources" ON public.editorial_theme_sources
  FOR ALL TO authenticated
  USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

CREATE TRIGGER editorial_themes_updated_at
  BEFORE UPDATE ON public.editorial_themes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Lien recommandation -> thème ─────────────────────────────────────────────
ALTER TABLE public.editorial_recommendations
  ADD COLUMN IF NOT EXISTS theme_id uuid REFERENCES public.editorial_themes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signal_count integer NOT NULL DEFAULT 1;

-- ── Cron de backfill : qualifie 20 transcripts toutes les 10 minutes ────────
-- No-op (une requête SQL) quand il n'y a plus rien à qualifier.
SELECT cron.unschedule('editorial-backfill')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'editorial-backfill');

SELECT cron.schedule(
  'editorial-backfill',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/editorial-backfill',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{"limit": 20}'::jsonb
  ) AS request_id
  WHERE EXISTS (
    SELECT 1 FROM public.transcripts
    WHERE status = 'ready' AND raw_text IS NOT NULL AND editorial_qualification IS NULL
    LIMIT 1
  );
  $$
);
