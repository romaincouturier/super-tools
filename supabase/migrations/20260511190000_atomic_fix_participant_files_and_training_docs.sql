-- Atomic fix: drop ALL policies on participant_files and training-documents
-- using dynamic SQL so we catch every policy regardless of name.
-- Prevents the "RLS enabled + no INSERT policy = everything blocked" state.

-- ── 1. Wipe all policies on participant_files ───────────────────────────
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'participant_files'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.participant_files', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY participant_files_select
  ON public.participant_files FOR SELECT
  TO authenticated USING (true);

CREATE POLICY participant_files_insert
  ON public.participant_files FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY participant_files_update
  ON public.participant_files FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY participant_files_delete
  ON public.participant_files FOR DELETE
  TO authenticated USING (true);

-- ── 2. Wipe all policies on storage.objects for training-documents ───────
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (
        policyname ILIKE '%training%document%'
        OR policyname ILIKE '%training_document%'
        OR policyname ILIKE 'td_%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY training_documents_select
  ON storage.objects FOR SELECT
  TO public USING (bucket_id = 'training-documents');

CREATE POLICY training_documents_insert
  ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'training-documents');

CREATE POLICY training_documents_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'training-documents')
  WITH CHECK (bucket_id = 'training-documents');

CREATE POLICY training_documents_delete
  ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'training-documents');

-- ── 3. Ensure bucket allows all MIME types (remove any restriction) ──────
UPDATE storage.buckets
SET allowed_mime_types = NULL
WHERE id = 'training-documents';
