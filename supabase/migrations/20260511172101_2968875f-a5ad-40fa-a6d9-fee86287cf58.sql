DROP POLICY IF EXISTS "mission_documents_insert" ON storage.objects;

CREATE POLICY "mission_documents_insert"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'mission-documents'
  AND auth.uid() IS NOT NULL
);