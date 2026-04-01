-- ============================================================
-- Agent RAG Infrastructure — Embeddings + Search + Conversations
-- ============================================================

-- 0. Ensure pgvector extension (idempotent, already enabled by watch module)
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ============================================================
-- 1. Universal document embeddings table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source identification
  source_type text NOT NULL,                    -- 'crm_card', 'crm_comment', 'crm_email', 'training', 'mission', 'inbound_email', 'quote', 'support_ticket', 'coaching_summary', 'content_card', 'lms_lesson', etc.
  source_id uuid NOT NULL,                      -- PK of the source record
  chunk_index int NOT NULL DEFAULT 0,           -- for long content split into chunks

  -- Content
  content text NOT NULL,                        -- the text that was embedded
  embedding extensions.vector(1536),            -- OpenAI text-embedding-3-small

  -- Metadata for filtering (denormalized for performance)
  source_title text,                            -- title/subject for display
  source_date timestamptz,                      -- date of the source record
  metadata jsonb NOT NULL DEFAULT '{}',         -- flexible metadata (email, card_id, training_id, etc.)

  -- Audit
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Unique constraint: one embedding per source record + chunk
  UNIQUE (source_type, source_id, chunk_index)
);

-- Indexes
CREATE INDEX idx_doc_embeddings_source_type ON public.document_embeddings (source_type);
CREATE INDEX idx_doc_embeddings_source_id ON public.document_embeddings (source_id);
CREATE INDEX idx_doc_embeddings_source_date ON public.document_embeddings (source_date DESC);
CREATE INDEX idx_doc_embeddings_metadata ON public.document_embeddings USING gin (metadata);
CREATE INDEX idx_doc_embeddings_vector ON public.document_embeddings
  USING hnsw (embedding extensions.vector_cosine_ops) WHERE embedding IS NOT NULL;

-- ============================================================
-- 2. Semantic search function
-- ============================================================
CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding text,
  match_threshold float DEFAULT 0.7,
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
AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.id,
    de.source_type,
    de.source_id,
    de.chunk_index,
    de.content,
    de.source_title,
    de.source_date,
    de.metadata,
    1 - (de.embedding <=> query_embedding::extensions.vector) AS similarity
  FROM public.document_embeddings de
  WHERE de.embedding IS NOT NULL
    AND 1 - (de.embedding <=> query_embedding::extensions.vector) > match_threshold
    AND (filter_source_types IS NULL OR de.source_type = ANY(filter_source_types))
  ORDER BY de.embedding <=> query_embedding::extensions.vector
  LIMIT match_count;
END;
$$;

-- ============================================================
-- 3. Agent conversations table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agent_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,                                    -- auto-generated from first message
  messages jsonb NOT NULL DEFAULT '[]',          -- full conversation history [{role, content}]
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_conversations_user ON public.agent_conversations (user_id, updated_at DESC);

-- ============================================================
-- 4. Read-only SQL query function for the agent
-- ============================================================
CREATE OR REPLACE FUNCTION public.agent_sql_query(query_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  normalized text;
  clean_query text;
BEGIN
  -- Strip trailing semicolons and whitespace
  clean_query := regexp_replace(trim(query_text), ';\s*$', '');
  -- Normalize: trim and lowercase for validation
  normalized := lower(clean_query);

  -- Only allow SELECT statements
  IF NOT (normalized LIKE 'select%' OR normalized LIKE 'with%') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;

  -- Block dangerous keywords (word boundaries to avoid matching column names like updated_at)
  IF normalized ~ '\m(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|execute)\M' THEN
    RAISE EXCEPTION 'Write operations are not allowed';
  END IF;

  -- Block multiple statements
  IF clean_query ~ ';' THEN
    RAISE EXCEPTION 'Multiple statements are not allowed';
  END IF;

  -- Execute in read-only mode with a row limit to prevent huge results
  SET LOCAL transaction_read_only = true;
  EXECUTE format('SELECT jsonb_agg(row_to_json(sub)) FROM (SELECT * FROM (%s) _inner LIMIT 100) sub', clean_query) INTO result;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- ============================================================
-- 5. RLS policies
-- ============================================================
ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;

-- Document embeddings: all authenticated users can read (RLS on source tables already protects data)
CREATE POLICY "doc_embeddings_select" ON public.document_embeddings
  FOR SELECT TO authenticated USING (true);

-- Only the system (service_role) can insert/update/delete embeddings
CREATE POLICY "doc_embeddings_insert" ON public.document_embeddings
  FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "doc_embeddings_update" ON public.document_embeddings
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "doc_embeddings_delete" ON public.document_embeddings
  FOR DELETE TO service_role USING (true);

-- Agent conversations: users can only access their own
CREATE POLICY "agent_conversations_select" ON public.agent_conversations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "agent_conversations_insert" ON public.agent_conversations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "agent_conversations_update" ON public.agent_conversations
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "agent_conversations_delete" ON public.agent_conversations
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
