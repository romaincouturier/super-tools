-- Drop existing INSERT policy that doesn't check authentication
DROP POLICY IF EXISTS "Authenticated users can upload training documents" ON storage.objects;

-- Create new policy that properly checks for authenticated users
CREATE POLICY "Authenticated users can upload training documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'training-documents');

-- Also fix the other storage policies to ensure they check for authenticated role
DROP POLICY IF EXISTS "Authenticated users can view training documents" ON storage.objects;
CREATE POLICY "Authenticated users can view training documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'training-documents');

DROP POLICY IF EXISTS "Authenticated users can update training documents" ON storage.objects;
CREATE POLICY "Authenticated users can update training documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'training-documents');

DROP POLICY IF EXISTS "Authenticated users can delete training documents" ON storage.objects;
CREATE POLICY "Authenticated users can delete training documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'training-documents');

-- Same for training-programs bucket
DROP POLICY IF EXISTS "Authenticated users can upload training programs" ON storage.objects;
CREATE POLICY "Authenticated users can upload training programs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'training-programs');

DROP POLICY IF EXISTS "Authenticated users can update training programs" ON storage.objects;
CREATE POLICY "Authenticated users can update training programs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'training-programs');

DROP POLICY IF EXISTS "Authenticated users can delete training programs" ON storage.objects;
CREATE POLICY "Authenticated users can delete training programs"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'training-programs');