DROP POLICY IF EXISTS auth_upload_lms ON storage.objects;
DROP POLICY IF EXISTS auth_update_lms ON storage.objects;
DROP POLICY IF EXISTS auth_delete_lms ON storage.objects;
DROP POLICY IF EXISTS public_read_lms ON storage.objects;

CREATE POLICY "Authenticated users can upload LMS content"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lms-content' AND auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can update LMS content"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'lms-content' AND auth.uid() IS NOT NULL
)
WITH CHECK (
  bucket_id = 'lms-content' AND auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can delete LMS content"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'lms-content' AND auth.uid() IS NOT NULL
);

CREATE POLICY "Public can read LMS content"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'lms-content'
);