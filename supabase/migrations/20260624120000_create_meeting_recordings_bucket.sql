-- Private bucket for in-browser meeting recordings (mic + system audio).
-- Files are short-lived: uploaded, transcribed via a signed URL, then deleted.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'meeting-recordings',
  'meeting-recordings',
  false,
  524288000, -- 500MB, large enough for multi-hour meetings
  ARRAY['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "meeting_recordings_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'meeting-recordings');

CREATE POLICY "meeting_recordings_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'meeting-recordings');

CREATE POLICY "meeting_recordings_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'meeting-recordings');
