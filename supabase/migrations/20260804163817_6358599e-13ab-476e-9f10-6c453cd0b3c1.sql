DROP POLICY IF EXISTS "tender_documents_storage_select" ON storage.objects;
CREATE POLICY "tender_documents_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'tender-documents' AND public.is_staff_user());