-- Daily snapshots of database size
CREATE TABLE IF NOT EXISTS public.db_size_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_size_bytes BIGINT NOT NULL,
  table_sizes JSONB, -- { "table_name": size_bytes, ... }
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(snapshot_date)
);

-- RLS: only authenticated users can read
ALTER TABLE public.db_size_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read db_size_snapshots"
  ON public.db_size_snapshots FOR SELECT TO authenticated USING (true);

-- Service role needs insert (edge function uses service role)
CREATE POLICY "Service role can insert db_size_snapshots"
  ON public.db_size_snapshots FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Service role can update db_size_snapshots"
  ON public.db_size_snapshots FOR UPDATE TO service_role USING (true);

-- Index for date-based queries
CREATE INDEX idx_db_size_snapshots_date ON public.db_size_snapshots(snapshot_date);

-- Function to get current database size (callable via RPC)
CREATE OR REPLACE FUNCTION public.get_db_size()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_size_bytes', pg_database_size(current_database()),
    'table_sizes', (
      SELECT json_object_agg(
        schemaname || '.' || tablename,
        pg_total_relation_size(schemaname || '.' || tablename)
      )
      FROM pg_tables
      WHERE schemaname = 'public'
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant execute to service_role (for edge function)
GRANT EXECUTE ON FUNCTION public.get_db_size() TO service_role;
-- Also grant to authenticated for direct frontend calls
GRANT EXECUTE ON FUNCTION public.get_db_size() TO authenticated;
