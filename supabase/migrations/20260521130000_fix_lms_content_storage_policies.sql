-- Definitive fix for lms-content storage bucket policies.
--
-- The previous migrations created/replaced individual policies, which can
-- leave the database in an inconsistent state if some policies were already
-- deleted or if the names changed.  This migration wipes ALL existing policies
-- that reference the lms-content bucket (by name or by USING/WITH CHECK
-- content) and recreates a clean, complete set.

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND (
        COALESCE(qual,       '') ILIKE '%lms-content%'
        OR COALESCE(with_check, '') ILIKE '%lms-content%'
        OR policyname ILIKE '%lms%content%'
        OR policyname ILIKE '%lms_content%'
        OR policyname IN (
          'auth_upload_lms',
          'auth_update_lms',
          'auth_delete_lms',
          'public_read_lms',
          'Authenticated users can upload LMS content',
          'Authenticated users can update LMS content',
          'Authenticated users can delete LMS content',
          'Public can read LMS content',
          'anon_upload_lms_content',
          'anon_update_lms_content'
        )
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Ensure the bucket exists (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('lms-content', 'lms-content', true)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users: full read/write access
CREATE POLICY "lms_content_insert_authenticated"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'lms-content');

CREATE POLICY "lms_content_update_authenticated"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING  (bucket_id = 'lms-content')
  WITH CHECK (bucket_id = 'lms-content');

CREATE POLICY "lms_content_delete_authenticated"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'lms-content');

-- Anon users: upload access (covers the JWT-refresh race on page load)
CREATE POLICY "lms_content_insert_anon"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'lms-content');

CREATE POLICY "lms_content_update_anon"
  ON storage.objects FOR UPDATE
  TO anon
  USING  (bucket_id = 'lms-content')
  WITH CHECK (bucket_id = 'lms-content');

-- Public read access
CREATE POLICY "lms_content_select_public"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'lms-content');
