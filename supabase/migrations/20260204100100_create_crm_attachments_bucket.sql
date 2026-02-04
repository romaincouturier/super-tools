-- Create storage bucket for CRM attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'crm-attachments',
  'crm-attachments',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'text/csv']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for crm-attachments bucket
CREATE POLICY "crm_attachments_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'crm-attachments');

CREATE POLICY "crm_attachments_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'crm-attachments' AND (
      EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
      OR EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'crm')
    )
  );

CREATE POLICY "crm_attachments_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'crm-attachments' AND (
      EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr')
      OR EXISTS (SELECT 1 FROM user_module_access WHERE user_id = auth.uid() AND module::text = 'crm')
    )
  );
