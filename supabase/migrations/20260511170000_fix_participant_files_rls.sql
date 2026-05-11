-- Fix participant_files RLS: two earlier migrations created conflicting policies
-- with the same names but different conditions (auth.role() vs TO authenticated).
-- Drop all and recreate with a single unambiguous set.
DROP POLICY IF EXISTS "Authenticated users can view participant files" ON public.participant_files;
DROP POLICY IF EXISTS "Authenticated users can insert participant files" ON public.participant_files;
DROP POLICY IF EXISTS "Authenticated users can update participant files" ON public.participant_files;
DROP POLICY IF EXISTS "Authenticated users can delete participant files" ON public.participant_files;

CREATE POLICY "participant_files_select"
  ON public.participant_files FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "participant_files_insert"
  ON public.participant_files FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "participant_files_update"
  ON public.participant_files FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "participant_files_delete"
  ON public.participant_files FOR DELETE
  TO authenticated
  USING (true);

-- Also clean up training-documents storage policies: previous migrations
-- left the original "Authenticated users can …" policies from 20260130103200
-- in place while adding duplicate "training_documents_*" policies.
-- Drop the originals so only the clean set from 20260511162001 remains.
DROP POLICY IF EXISTS "Authenticated users can upload training documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view training documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete training documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update training documents" ON storage.objects;
