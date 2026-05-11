DROP POLICY IF EXISTS crm_attachments_insert ON storage.objects;
DROP POLICY IF EXISTS crm_attachments_delete ON storage.objects;

CREATE POLICY crm_attachments_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'crm-attachments'
  AND auth.uid() IS NOT NULL
  AND (
    public.is_admin(auth.uid())
    OR public.has_module_access(auth.uid(), 'crm')
  )
);

CREATE POLICY crm_attachments_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'crm-attachments'
  AND auth.uid() IS NOT NULL
  AND (
    public.is_admin(auth.uid())
    OR public.has_module_access(auth.uid(), 'crm')
  )
);