-- Agent — recherche hybride : fusion RRF (vecteur + plein texte français)
-- avec boost de fraîcheur. Remplace la recherche purement vectorielle à
-- seuil fixe de match_documents pour le tool search_content.

CREATE INDEX IF NOT EXISTS idx_doc_embeddings_fts
  ON public.document_embeddings
  USING gin (to_tsvector('french', content));

CREATE OR REPLACE FUNCTION public.match_documents_hybrid(
  query_text text,
  query_embedding text,
  match_count int DEFAULT 10,
  filter_source_types text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  source_type text,
  source_id uuid,
  chunk_index int,
  content text,
  source_title text,
  source_date timestamptz,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT de.id AS doc_id,
           row_number() OVER (ORDER BY de.embedding <=> query_embedding::extensions.vector) AS rank
    FROM public.document_embeddings de
    WHERE de.embedding IS NOT NULL
      AND (filter_source_types IS NULL OR de.source_type = ANY(filter_source_types))
    ORDER BY de.embedding <=> query_embedding::extensions.vector
    LIMIT 40
  ),
  keyword_results AS (
    SELECT de.id AS doc_id,
           row_number() OVER (
             ORDER BY ts_rank(to_tsvector('french', de.content),
                              websearch_to_tsquery('french', query_text)) DESC
           ) AS rank
    FROM public.document_embeddings de
    WHERE to_tsvector('french', de.content) @@ websearch_to_tsquery('french', query_text)
      AND (filter_source_types IS NULL OR de.source_type = ANY(filter_source_types))
    LIMIT 40
  ),
  fused AS (
    SELECT COALESCE(v.doc_id, k.doc_id) AS doc_id,
           COALESCE(1.0 / (60 + v.rank), 0) + COALESCE(1.0 / (60 + k.rank), 0) AS rrf_score
    FROM vector_results v
    FULL OUTER JOIN keyword_results k ON v.doc_id = k.doc_id
  )
  SELECT
    de.id,
    de.source_type,
    de.source_id,
    de.chunk_index,
    de.content,
    de.source_title,
    de.source_date,
    de.metadata,
    -- score RRF + boost de fraîcheur (demi-vie ~6 mois), exposé comme "similarity"
    (f.rrf_score
      + CASE WHEN de.source_date IS NOT NULL
          THEN 0.005 * exp(-GREATEST(extract(epoch FROM (now() - de.source_date)), 0) / (86400.0 * 180))
          ELSE 0 END
    )::float AS similarity
  FROM fused f
  JOIN public.document_embeddings de ON de.id = f.doc_id
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
