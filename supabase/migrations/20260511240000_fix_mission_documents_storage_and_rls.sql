-- Fix mission-documents storage policies (par contenu de policy)
-- + Fix mission_documents table RLS (auth.role() → TO authenticated)

-- ── 1. Storage: mission-documents bucket ─────────────────────────────────────
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        COALESCE(qual, '')        ILIKE '%mission-documents%'
        OR COALESCE(with_check, '') ILIKE '%mission-documents%'
        OR policyname              ILIKE '%mission%document%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY mission_documents_storage_select
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'mission-documents');

CREATE POLICY mission_documents_storage_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mission-documents');

CREATE POLICY mission_documents_storage_update
  ON storage.objects FOR UPDATE TO authenticated
  USING  (bucket_id = 'mission-documents')
  WITH CHECK (bucket_id = 'mission-documents');

CREATE POLICY mission_documents_storage_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'mission-documents');

-- ── 2. Table mission_documents RLS ───────────────────────────────────────────
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'mission_documents'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.mission_documents', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY mission_documents_select
  ON public.mission_documents FOR SELECT
  TO authenticated USING (true);

CREATE POLICY mission_documents_insert
  ON public.mission_documents FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY mission_documents_update
  ON public.mission_documents FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY mission_documents_delete
  ON public.mission_documents FOR DELETE
  TO authenticated USING (true);

-- ── 3. Table training_documents RLS ─────────────────────────────────────────
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'training_documents'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.training_documents', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY training_documents_select
  ON public.training_documents FOR SELECT
  TO authenticated USING (true);

CREATE POLICY training_documents_insert
  ON public.training_documents FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY training_documents_update
  ON public.training_documents FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY training_documents_delete
  ON public.training_documents FOR DELETE
  TO authenticated USING (true);
