-- 1. Public schema: replace always-true write policies with staff checks
DO $$
DECLARE
  r record;
  t text;
  tables text[] := '{}';
  keep text[] := ARRAY[
    'book_analytics_events_anon_insert',
    'book_analytics_events_auth_insert',
    'public_insert_survey_answers',
    'public_insert_survey_responses',
    'Anyone can log events'
  ];
BEGIN
  FOR r IN
    SELECT tablename, policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND cmd <> 'SELECT'
       AND (qual = 'true' OR with_check = 'true')
       AND NOT roles @> ARRAY['service_role']::name[]
       AND policyname <> ALL (keep)
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
    IF NOT (r.tablename = ANY (tables)) THEN
      tables := array_append(tables, r.tablename);
    END IF;
  END LOOP;

  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = t AND policyname = 'staff_manage_all'
    ) THEN
      EXECUTE format(
        'CREATE POLICY staff_manage_all ON public.%I FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user())',
        t
      );
    END IF;
  END LOOP;
END $$;

-- 2. Storage: mission documents / media scoped to staff with missions access
DROP POLICY IF EXISTS mission_documents_storage_select ON storage.objects;
DROP POLICY IF EXISTS mission_documents_storage_insert ON storage.objects;
DROP POLICY IF EXISTS mission_documents_storage_update ON storage.objects;
DROP POLICY IF EXISTS mission_documents_storage_delete ON storage.objects;
DROP POLICY IF EXISTS mission_media_select ON storage.objects;
DROP POLICY IF EXISTS mission_media_insert ON storage.objects;
DROP POLICY IF EXISTS mission_media_update ON storage.objects;
DROP POLICY IF EXISTS mission_media_delete ON storage.objects;

CREATE POLICY mission_files_missions_access ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id IN ('mission-documents', 'mission-media')
    AND (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'missions'))
  )
  WITH CHECK (
    bucket_id IN ('mission-documents', 'mission-media')
    AND (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'missions'))
  );

-- 3. Storage: support attachments staff only
DROP POLICY IF EXISTS support_attachments_public_select ON storage.objects;
DROP POLICY IF EXISTS support_attachments_select ON storage.objects;
DROP POLICY IF EXISTS support_attachments_insert ON storage.objects;
DROP POLICY IF EXISTS support_attachments_delete ON storage.objects;

CREATE POLICY support_attachments_staff ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'support-attachments' AND public.is_staff_user())
  WITH CHECK (bucket_id = 'support-attachments' AND public.is_staff_user());

-- 4. Storage: training documents remain publicly readable (legacy email links),
--    writes restricted to staff
DROP POLICY IF EXISTS training_documents_select ON storage.objects;
DROP POLICY IF EXISTS training_documents_insert ON storage.objects;
DROP POLICY IF EXISTS training_documents_update ON storage.objects;
DROP POLICY IF EXISTS training_documents_delete ON storage.objects;

CREATE POLICY training_documents_public_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'training-documents');

CREATE POLICY training_documents_staff_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'training-documents' AND public.is_staff_user());

CREATE POLICY training_documents_staff_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'training-documents' AND public.is_staff_user())
  WITH CHECK (bucket_id = 'training-documents' AND public.is_staff_user());

CREATE POLICY training_documents_staff_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'training-documents' AND public.is_staff_user());

-- 5. Storage: learner photos stay publicly readable, management restricted
DROP POLICY IF EXISTS auth_manage_learner_photos ON storage.objects;

CREATE POLICY learner_photos_staff_manage ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'learner-photos' AND public.is_staff_user())
  WITH CHECK (bucket_id = 'learner-photos' AND public.is_staff_user());