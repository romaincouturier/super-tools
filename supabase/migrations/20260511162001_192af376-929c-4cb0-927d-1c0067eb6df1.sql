-- Fix training-documents storage policies: storage uploads can have an authenticated role
-- while auth.uid() is not reliably exposed during the storage object insert path.
DROP POLICY IF EXISTS training_documents_insert_policy ON storage.objects;
DROP POLICY IF EXISTS training_documents_update_policy ON storage.objects;
DROP POLICY IF EXISTS training_documents_delete_policy ON storage.objects;
DROP POLICY IF EXISTS training_documents_select_policy ON storage.objects;
DROP POLICY IF EXISTS training_documents_public_read ON storage.objects;

CREATE POLICY training_documents_public_read
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'training-documents');

CREATE POLICY training_documents_insert_policy
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'training-documents');

CREATE POLICY training_documents_update_policy
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'training-documents')
WITH CHECK (bucket_id = 'training-documents');

CREATE POLICY training_documents_delete_policy
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'training-documents');