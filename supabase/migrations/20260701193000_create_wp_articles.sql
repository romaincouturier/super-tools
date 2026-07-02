-- ST-2026-0219 — Base "Articles publiés" alimentée par import CSV WordPress.
-- Lecture seule vis-à-vis de WordPress : SuperTool ne modifie jamais WP.

CREATE TABLE IF NOT EXISTS public.wp_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wp_id bigint,                    -- ID WordPress (identifiant unique principal)
  url text,                        -- fallback d'identification si wp_id absent
  title text NOT NULL DEFAULT '',
  published_at timestamptz,
  modified_at timestamptz,
  author text,
  category text,
  tags text[] NOT NULL DEFAULT '{}',
  excerpt text,
  content text,
  status text NOT NULL DEFAULT 'publish',
  views integer,
  imported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unicité : wp_id prioritaire, sinon URL. Index partiels pour tolérer les NULL.
CREATE UNIQUE INDEX IF NOT EXISTS wp_articles_wp_id_key ON public.wp_articles (wp_id) WHERE wp_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS wp_articles_url_key ON public.wp_articles (url) WHERE url IS NOT NULL;
CREATE INDEX IF NOT EXISTS wp_articles_published_idx ON public.wp_articles (published_at DESC);

ALTER TABLE public.wp_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage wp_articles" ON public.wp_articles
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER wp_articles_updated_at
  BEFORE UPDATE ON public.wp_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
