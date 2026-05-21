DROP POLICY IF EXISTS "media_bucket_insert_public_fix" ON storage.objects;
DROP POLICY IF EXISTS "media_bucket_update_public_fix" ON storage.objects;
DROP POLICY IF EXISTS "media_bucket_delete_public_fix" ON storage.objects;

CREATE POLICY "media_bucket_insert_public_fix"
  ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'media');

CREATE POLICY "media_bucket_update_public_fix"
  ON storage.objects
  FOR UPDATE
  TO public
  USING (bucket_id = 'media')
  WITH CHECK (bucket_id = 'media');

CREATE POLICY "media_bucket_delete_public_fix"
  ON storage.objects
  FOR DELETE
  TO public
  USING (bucket_id = 'media');