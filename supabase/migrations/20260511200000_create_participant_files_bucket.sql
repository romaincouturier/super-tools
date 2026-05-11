-- Create a dedicated bucket for participant file attachments.
-- This avoids the messy policy history of training-documents which has had
-- 5+ rounds of DROP/CREATE with different names, leaving an uncertain state.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'participant-files',
  'participant-files',
  true,
  52428800, -- 50 MB
  NULL      -- all MIME types allowed
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY participant_files_bucket_select
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'participant-files');

CREATE POLICY participant_files_bucket_insert
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'participant-files');

CREATE POLICY participant_files_bucket_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'participant-files')
  WITH CHECK (bucket_id = 'participant-files');

CREATE POLICY participant_files_bucket_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'participant-files');
