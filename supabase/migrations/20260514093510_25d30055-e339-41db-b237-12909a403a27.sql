INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('devis-pdfs', 'devis-pdfs', true, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf'];

DROP POLICY IF EXISTS "Authenticated users can read devis PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Public can read devis PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Service role can insert devis PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Service role can upload devis PDFs" ON storage.objects;

CREATE POLICY "Public can read devis PDFs"
ON storage.objects
FOR SELECT
USING (bucket_id = 'devis-pdfs');

CREATE POLICY "Service role can upload devis PDFs"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'devis-pdfs');