-- Make training-documents storage INSERT/UPDATE/DELETE policies more robust
-- by also accepting requests where auth.uid() is set, regardless of the
-- granted Postgres role binding (some client paths bind to 'public' instead
-- of 'authenticated' even when the JWT is valid).

DROP POLICY IF EXISTS "training_documents_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "training_documents_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "training_documents_delete_policy" ON storage.objects;
DROP POLICY IF EXISTS "training_documents_select_policy" ON storage.objects;

CREATE POLICY "training_documents_insert_policy"
ON storage.objects FOR INSERT
TO authenticated, anon
WITH CHECK (bucket_id = 'training-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "training_documents_update_policy"
ON storage.objects FOR UPDATE
TO authenticated, anon
USING (bucket_id = 'training-documents' AND auth.uid() IS NOT NULL)
WITH CHECK (bucket_id = 'training-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "training_documents_delete_policy"
ON storage.objects FOR DELETE
TO authenticated, anon
USING (bucket_id = 'training-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "training_documents_select_policy"
ON storage.objects FOR SELECT
TO authenticated, anon
USING (bucket_id = 'training-documents' AND auth.uid() IS NOT NULL);