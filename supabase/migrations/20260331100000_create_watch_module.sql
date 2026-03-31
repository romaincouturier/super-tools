-- ============================================================
-- Module Veille (Watch) — Tables & indexes
-- ============================================================

-- 1. Main content table
CREATE TABLE IF NOT EXISTS public.watch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Content
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',               -- extracted / pasted text
  content_type text NOT NULL DEFAULT 'text'
    CHECK (content_type IN ('text', 'url', 'image', 'audio')),
  -- Source references
  source_url text,                              -- original URL (for url / image / audio)
  file_url text,                                -- Supabase storage URL (image / audio)
  file_name text,
  file_size bigint,
  mime_type text,
  -- Metadata
  tags text[] NOT NULL DEFAULT '{}',
  relevance_score numeric(5,2) NOT NULL DEFAULT 100.00,  -- freshness score, decays over time
  is_shared boolean NOT NULL DEFAULT false,               -- "à partager" flag
  is_duplicate boolean NOT NULL DEFAULT false,             -- flagged as potential duplicate
  duplicate_of uuid REFERENCES public.watch_items(id) ON DELETE SET NULL,
  -- Clustering
  cluster_id uuid,                                         -- assigned cluster (nullable)
  embedding vector(1536),                                  -- OpenAI text-embedding-3-small
  -- Audit
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_watch_items_tags ON public.watch_items USING gin (tags);
CREATE INDEX idx_watch_items_created_at ON public.watch_items (created_at DESC);
CREATE INDEX idx_watch_items_relevance ON public.watch_items (relevance_score DESC);
CREATE INDEX idx_watch_items_cluster ON public.watch_items (cluster_id) WHERE cluster_id IS NOT NULL;
CREATE INDEX idx_watch_items_content_type ON public.watch_items (content_type);
CREATE INDEX idx_watch_items_shared ON public.watch_items (is_shared) WHERE is_shared = true;

-- 2. Clusters table — groups of related content
CREATE TABLE IF NOT EXISTS public.watch_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  slack_posted_at timestamptz,                   -- when an article was posted to Slack
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- FK from watch_items to watch_clusters
ALTER TABLE public.watch_items
  ADD CONSTRAINT fk_watch_items_cluster
  FOREIGN KEY (cluster_id) REFERENCES public.watch_clusters(id) ON DELETE SET NULL;

-- 3. Weekly digests history
CREATE TABLE IF NOT EXISTS public.watch_digests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  week_end date NOT NULL,
  summary text NOT NULL DEFAULT '',
  item_ids uuid[] NOT NULL DEFAULT '{}',
  slack_posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_watch_digests_week ON public.watch_digests (week_start);

-- 4. Storage bucket for watch files (images, audio)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'watch',
  'watch',
  true,
  52428800,  -- 50 MB
  ARRAY[
    'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/x-m4a', 'audio/mp3'
  ]
) ON CONFLICT (id) DO NOTHING;

-- 5. RLS policies
ALTER TABLE public.watch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_digests ENABLE ROW LEVEL SECURITY;

-- All authenticated users can CRUD watch items
CREATE POLICY "watch_items_select" ON public.watch_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "watch_items_insert" ON public.watch_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "watch_items_update" ON public.watch_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "watch_items_delete" ON public.watch_items FOR DELETE TO authenticated USING (true);

CREATE POLICY "watch_clusters_select" ON public.watch_clusters FOR SELECT TO authenticated USING (true);
CREATE POLICY "watch_clusters_insert" ON public.watch_clusters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "watch_clusters_update" ON public.watch_clusters FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "watch_clusters_delete" ON public.watch_clusters FOR DELETE TO authenticated USING (true);

CREATE POLICY "watch_digests_select" ON public.watch_digests FOR SELECT TO authenticated USING (true);
CREATE POLICY "watch_digests_insert" ON public.watch_digests FOR INSERT TO authenticated WITH CHECK (true);

-- Storage policies for watch bucket
CREATE POLICY "watch_storage_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'watch');
CREATE POLICY "watch_storage_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'watch');
CREATE POLICY "watch_storage_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'watch');

-- 6. Function to decay relevance scores (called by cron)
CREATE OR REPLACE FUNCTION public.decay_watch_relevance()
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.watch_items
  SET relevance_score = GREATEST(0, relevance_score - (EXTRACT(EPOCH FROM (now() - updated_at)) / 86400.0) * 0.5)
  WHERE relevance_score > 0;
$$;

-- 7. Similarity search function (used by watch-check-duplicate)
CREATE OR REPLACE FUNCTION public.match_watch_items(
  query_embedding text,
  match_threshold float DEFAULT 0.92,
  match_count int DEFAULT 5
)
RETURNS TABLE (id uuid, title text, similarity float)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    wi.id,
    wi.title,
    1 - (wi.embedding <=> query_embedding::vector) AS similarity
  FROM public.watch_items wi
  WHERE wi.embedding IS NOT NULL
    AND 1 - (wi.embedding <=> query_embedding::vector) > match_threshold
  ORDER BY wi.embedding <=> query_embedding::vector
  LIMIT match_count;
END;
$$;

-- 8. Add "veille" to module access
-- (Module will be registered as "veille" in the app)
