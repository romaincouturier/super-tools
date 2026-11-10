CREATE POLICY "attestations_staff_read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'attestations' AND EXISTS (
  SELECT 1 FROM public.execution_attestations a
  WHERE a.id::text = (storage.foldername(name))[1] AND public.can_access_attestation_source(a.source_type)));