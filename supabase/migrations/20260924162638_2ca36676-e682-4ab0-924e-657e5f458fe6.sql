CREATE OR REPLACE FUNCTION public.guard_profile_privileges()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.is_admin(auth.uid())
     AND (NEW.is_admin IS DISTINCT FROM OLD.is_admin
          OR NEW.org_id IS DISTINCT FROM OLD.org_id
          OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
    RAISE EXCEPTION 'Modification de privileges reservee aux administrateurs' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_profile_privileges ON public.profiles;
CREATE TRIGGER trg_guard_profile_privileges BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileges();

CREATE OR REPLACE FUNCTION public.upsert_profile(p_user_id uuid, p_email text, p_display_name text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND p_user_id <> auth.uid() AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Profil d''un autre utilisateur' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (p_user_id, p_email, p_display_name)
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
    updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.upsert_profile(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_profile(uuid, text, text) TO authenticated, service_role;

DROP POLICY IF EXISTS "training_documents_public_read" ON storage.objects;
DROP POLICY IF EXISTS "training_documents_staff_read" ON storage.objects;
CREATE POLICY "training_documents_staff_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'training-documents' AND public.is_staff_user());

DROP POLICY IF EXISTS "Service role can upload certificates" ON storage.objects;
DROP POLICY IF EXISTS "Service role can update certificates" ON storage.objects;
DROP POLICY IF EXISTS "Certificates are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload certificates" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update certificates" ON storage.objects;
DROP POLICY IF EXISTS "Staff can read certificates" ON storage.objects;
CREATE POLICY "Staff can upload certificates" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'certificates' AND public.is_staff_user());
CREATE POLICY "Staff can update certificates" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'certificates' AND public.is_staff_user())
  WITH CHECK (bucket_id = 'certificates' AND public.is_staff_user());
CREATE POLICY "Staff can read certificates" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'certificates' AND public.is_staff_user());

DO $$
DECLARE
  pol record;
  staff_buckets text[] := ARRAY['media','training-media','training-programs','training-supports',
    'event-media','ideas','watch','meeting-recordings','game-restock-files','review-images'];
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND cmd IN ('INSERT','UPDATE','DELETE')
      AND EXISTS (SELECT 1 FROM unnest(staff_buckets) b
                  WHERE coalesce(qual,'') || coalesce(with_check,'') LIKE '%''' || b || '''%')
      AND coalesce(qual,'') || coalesce(with_check,'') NOT LIKE '%is_staff_user%'
      AND coalesce(qual,'') || coalesce(with_check,'') NOT LIKE '%is_admin%'
      AND coalesce(qual,'') || coalesce(with_check,'') NOT LIKE '%has_module_access%'
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "staff_buckets_write" ON storage.objects;
CREATE POLICY "staff_buckets_write" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id IN ('media','training-media','training-programs','training-supports',
    'event-media','ideas','watch','meeting-recordings','game-restock-files','review-images')
    AND public.is_staff_user())
  WITH CHECK (bucket_id IN ('media','training-media','training-programs','training-supports',
    'event-media','ideas','watch','meeting-recordings','game-restock-files','review-images')
    AND public.is_staff_user());

DROP POLICY IF EXISTS "ideas_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "watch_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "meeting_recordings_select" ON storage.objects;
DROP POLICY IF EXISTS "auth_read_game_restock_files" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for app-screenshots" ON storage.objects;

DROP POLICY IF EXISTS "doc_embeddings_select" ON public.document_embeddings;
CREATE POLICY "doc_embeddings_select" ON public.document_embeddings FOR SELECT TO authenticated USING (public.is_staff_user());
DROP POLICY IF EXISTS "Authenticated users can view transcripts" ON public.transcripts;
CREATE POLICY "Authenticated users can view transcripts" ON public.transcripts FOR SELECT TO authenticated USING (public.is_staff_user());
DROP POLICY IF EXISTS "indexation_queue_select" ON public.indexation_queue;
CREATE POLICY "indexation_queue_select" ON public.indexation_queue FOR SELECT TO authenticated USING (public.is_staff_user());

DROP POLICY IF EXISTS "Authenticated users can view event_transcripts" ON public.event_transcripts;
DROP POLICY IF EXISTS "Authenticated users can insert event_transcripts" ON public.event_transcripts;
DROP POLICY IF EXISTS "Authenticated users can delete event_transcripts" ON public.event_transcripts;
DROP POLICY IF EXISTS "staff_manage_all" ON public.event_transcripts;
CREATE POLICY "staff_manage_all" ON public.event_transcripts FOR ALL TO authenticated
  USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

DROP POLICY IF EXISTS "Users can view all email snippets" ON public.email_snippets;
DROP POLICY IF EXISTS "Users can create email snippets" ON public.email_snippets;
DROP POLICY IF EXISTS "Users can update email snippets" ON public.email_snippets;
DROP POLICY IF EXISTS "Users can delete email snippets" ON public.email_snippets;
DROP POLICY IF EXISTS "staff_manage_all" ON public.email_snippets;
CREATE POLICY "staff_manage_all" ON public.email_snippets FOR ALL TO authenticated
  USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

REVOKE ALL ON FUNCTION public.get_learner_portal_training_details(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_formulaire_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;