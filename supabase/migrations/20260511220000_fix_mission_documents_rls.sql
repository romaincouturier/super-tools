-- Fix mission_documents RLS: original policies used the deprecated
-- auth.role() = 'authenticated' pattern instead of TO authenticated.
-- Drop all and recreate with the modern pattern.

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
