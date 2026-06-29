-- Boîte à idées — lot 2 (anti-doublon/embeddings) + lot 3 (enrichissement IA)
-- Voir SPEC_BOITE_A_IDEES.md

-- 1. Colonnes embedding + champs IA
ALTER TABLE public.ideas
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(1536),
  ADD COLUMN IF NOT EXISTS ai_category text,
  ADD COLUMN IF NOT EXISTS ai_impact text,   -- faible / moyen / fort
  ADD COLUMN IF NOT EXISTS ai_effort text,   -- faible / moyen / fort
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS ai_enriched_at timestamptz;

CREATE INDEX IF NOT EXISTS ideas_embedding_idx
  ON public.ideas USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists = 100);

-- 2. RPC de similarité (anti-doublon à la saisie)
CREATE OR REPLACE FUNCTION public.match_ideas(
  query_embedding extensions.vector(1536),
  match_count int DEFAULT 5,
  exclude_id uuid DEFAULT NULL
)
RETURNS TABLE (id uuid, title text, status text, similarity float)
LANGUAGE sql STABLE AS $$
  SELECT i.id, i.title, i.status,
         1 - (i.embedding <=> query_embedding) AS similarity
  FROM public.ideas i
  WHERE i.embedding IS NOT NULL
    AND (exclude_id IS NULL OR i.id <> exclude_id)
  ORDER BY i.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_ideas(extensions.vector, int, uuid) TO authenticated;
