
-- ============================================================
-- Fix overly permissive RLS / Storage policies (security scan)
-- ============================================================

-- 1. coaching_bookings: remove unrestricted anon SELECT / INSERT
DROP POLICY IF EXISTS anon_select_coaching_bookings ON public.coaching_bookings;
DROP POLICY IF EXISTS anon_insert_coaching_bookings ON public.coaching_bookings;
-- anon_manage_coaching_bookings (ALL with learner email check) and auth_manage_coaching_bookings remain in place.

-- 2. mission_actions: remove public read-all policy
DROP POLICY IF EXISTS "Public can view mission actions" ON public.mission_actions;

-- 3. training_media: tighten SELECT to authenticated only
DROP POLICY IF EXISTS "Users can view training media" ON public.training_media;
CREATE POLICY "Authenticated users can view training media"
  ON public.training_media
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- Storage buckets
-- ============================================================

-- 4. admin-archives: admin-only for all operations
DROP POLICY IF EXISTS admin_archives_select ON storage.objects;
DROP POLICY IF EXISTS admin_archives_insert ON storage.objects;
DROP POLICY IF EXISTS admin_archives_update ON storage.objects;
DROP POLICY IF EXISTS admin_archives_delete ON storage.objects;

CREATE POLICY admin_archives_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'admin-archives' AND public.is_admin(auth.uid()));
CREATE POLICY admin_archives_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'admin-archives' AND public.is_admin(auth.uid()));
CREATE POLICY admin_archives_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'admin-archives' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'admin-archives' AND public.is_admin(auth.uid()));
CREATE POLICY admin_archives_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'admin-archives' AND public.is_admin(auth.uid()));

-- 5. lms-content: remove anon write/update
DROP POLICY IF EXISTS lms_content_insert_anon ON storage.objects;
DROP POLICY IF EXISTS lms_content_update_anon ON storage.objects;

-- 6. media bucket: remove anon write/delete (keep authenticated)
DROP POLICY IF EXISTS media_bucket_insert ON storage.objects;
DROP POLICY IF EXISTS media_bucket_update ON storage.objects;
DROP POLICY IF EXISTS media_bucket_delete ON storage.objects;
DROP POLICY IF EXISTS media_bucket_insert_public_fix ON storage.objects;
DROP POLICY IF EXISTS media_bucket_update_public_fix ON storage.objects;
DROP POLICY IF EXISTS media_bucket_delete_public_fix ON storage.objects;

CREATE POLICY media_bucket_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media');
CREATE POLICY media_bucket_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'media')
  WITH CHECK (bucket_id = 'media');
CREATE POLICY media_bucket_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'media');

-- 7. participant-files: restrict SELECT to authenticated
DROP POLICY IF EXISTS participant_files_bucket_select ON storage.objects;
CREATE POLICY participant_files_bucket_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'participant-files');

-- 8. crm-attachments: SELECT requires CRM access
DROP POLICY IF EXISTS crm_attachments_select ON storage.objects;
CREATE POLICY crm_attachments_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'crm-attachments'
    AND (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'crm'))
  );
