ALTER TABLE public.backup_runs
  ADD COLUMN IF NOT EXISTS db_status text,
  ADD COLUMN IF NOT EXISTS db_finished_at timestamptz,
  ADD COLUMN IF NOT EXISTS storage_status text,
  ADD COLUMN IF NOT EXISTS storage_finished_at timestamptz;

UPDATE public.backup_runs SET db_status = 'success', db_finished_at = finished_at
WHERE status = 'success' AND db_status IS NULL;

CREATE TABLE IF NOT EXISTS public.backup_storage_manifest (
  bucket text NOT NULL,
  path text NOT NULL,
  size_bytes bigint,
  etag text,
  source_updated_at timestamptz,
  drive_file_id text,
  backed_up_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket, path)
);
GRANT SELECT ON public.backup_storage_manifest TO authenticated;
GRANT ALL ON public.backup_storage_manifest TO service_role;
ALTER TABLE public.backup_storage_manifest ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read backup storage manifest" ON public.backup_storage_manifest;
CREATE POLICY "Admins read backup storage manifest" ON public.backup_storage_manifest
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));