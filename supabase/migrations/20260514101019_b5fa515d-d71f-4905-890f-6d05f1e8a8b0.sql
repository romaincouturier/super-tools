-- Recreate media bucket storage policies with explicit role grants
-- to fix RLS violation on dictation upload from CRM communication.
DROP POLICY IF EXISTS "media_bucket_insert" ON storage.objects;
DROP POLICY IF EXISTS "media_bucket_select" ON storage.objects;
DROP POLICY IF EXISTS "media_bucket_update" ON storage.objects;
DROP POLICY IF EXISTS "media_bucket_delete" ON storage.objects;

CREATE POLICY "media_bucket_select"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'media');

CREATE POLICY "media_bucket_insert"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'media');

CREATE POLICY "media_bucket_update"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'media')
  WITH CHECK (bucket_id = 'media');

CREATE POLICY "media_bucket_delete"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'media');