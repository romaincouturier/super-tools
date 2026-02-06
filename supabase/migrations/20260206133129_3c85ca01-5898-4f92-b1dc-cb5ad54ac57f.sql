-- Fix CRM storage policies that reference auth.users directly
-- This causes "permission denied for table users" for ALL storage operations

-- Drop the broken policies
DROP POLICY IF EXISTS "crm_attachments_insert" ON storage.objects;
DROP POLICY IF EXISTS "crm_attachments_delete" ON storage.objects;

-- Recreate using is_admin() SECURITY DEFINER function + has_crm_access()
CREATE POLICY "crm_attachments_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'crm-attachments'
  AND (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_module_access
      WHERE user_id = auth.uid() AND module::text = 'crm'
    )
  )
);

CREATE POLICY "crm_attachments_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'crm-attachments'
  AND (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_module_access
      WHERE user_id = auth.uid() AND module::text = 'crm'
    )
  )
);