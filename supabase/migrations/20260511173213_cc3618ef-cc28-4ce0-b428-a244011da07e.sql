DROP POLICY IF EXISTS "mission_documents_insert" ON storage.objects;
DROP POLICY IF EXISTS "mission_documents_authenticated_insert" ON storage.objects;

CREATE POLICY "mission_documents_authenticated_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'mission-documents'
);