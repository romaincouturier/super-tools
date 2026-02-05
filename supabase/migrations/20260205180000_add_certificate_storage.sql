-- Add certificate_url column to training_evaluations
ALTER TABLE public.training_evaluations
  ADD COLUMN IF NOT EXISTS certificate_url text;

-- Create certificates storage bucket (public read)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'certificates',
  'certificates',
  true,
  10485760, -- 10MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Public read access
CREATE POLICY "Public read access for certificates"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'certificates');

-- Service-role can insert (edge functions upload)
CREATE POLICY "Service role can upload certificates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'certificates');

-- Service-role can update
CREATE POLICY "Service role can update certificates"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'certificates')
WITH CHECK (bucket_id = 'certificates');
