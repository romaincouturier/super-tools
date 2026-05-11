UPDATE storage.buckets SET public = true WHERE id = 'support-attachments';

-- Allow public read access on support-attachments objects so existing public URLs
-- stored in support_tickets.screenshot_url and notification emails work.
DROP POLICY IF EXISTS support_attachments_public_select ON storage.objects;
CREATE POLICY support_attachments_public_select
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'support-attachments');