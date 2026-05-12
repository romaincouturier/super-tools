DROP POLICY IF EXISTS "media_bucket_insert" ON storage.objects;
DROP POLICY IF EXISTS "media_bucket_select" ON storage.objects;
DROP POLICY IF EXISTS "media_bucket_update" ON storage.objects;
DROP POLICY IF EXISTS "media_bucket_delete" ON storage.objects;

CREATE POLICY "media_bucket_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'media');

CREATE POLICY "media_bucket_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'media');

CREATE POLICY "media_bucket_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'media') WITH CHECK (bucket_id = 'media');

CREATE POLICY "media_bucket_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'media');