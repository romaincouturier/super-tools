-- Recherche hybride : filtre optionnel par mission.
-- Sans lui, une recherche sur le contexte d'une mission remonte des contenus
-- d'autres clients (constaté : 2 résultats hors sujet sur 4).
-- Une page/activité porte mission_id dans metadata ; la mission elle-même est
-- identifiée par source_id.

CREATE OR REPLACE FUNCTION public.match_documents_hybrid(
  query_text text,
  query_embedding text,
  match_count int DEFAULT 10,
  filter_source_types text[] DEFAULT NULL,
  filter_mission_id uuid DEFAULT NULL
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
  WITH scoped AS (
    SELECT de.*
    FROM public.document_embeddings de
    WHERE (filter_source_types IS NULL OR de.source_type = ANY(filter_source_types))
      AND (
        filter_mission_id IS NULL
        OR de.metadata->>'mission_id' = filter_mission_id::text
        OR (de.source_type = 'mission' AND de.source_id = filter_mission_id)
      )
  ),
  vector_results AS (
    SELECT s.id AS doc_id,
           row_number() OVER (ORDER BY s.embedding <=> query_embedding::extensions.vector) AS rank
    FROM scoped s
    WHERE s.embedding IS NOT NULL
    ORDER BY s.embedding <=> query_embedding::extensions.vector
    LIMIT 40
  ),
  keyword_results AS (
    SELECT s.id AS doc_id,
           row_number() OVER (
             ORDER BY ts_rank(to_tsvector('french', s.content),
                              websearch_to_tsquery('french', query_text)) DESC
           ) AS rank
    FROM scoped s
    WHERE to_tsvector('french', s.content) @@ websearch_to_tsquery('french', query_text)
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
