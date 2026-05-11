-- Allow authenticated users to use multipart uploads for storage buckets they have access to.
-- Without these policies, large file uploads (>6MB) fail with "new row violates row-level security policy"
-- because storage.s3_multipart_uploads has RLS enabled with no policies.

CREATE POLICY "Authenticated multipart uploads"
ON storage.s3_multipart_uploads
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated multipart upload parts"
ON storage.s3_multipart_uploads_parts
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);
