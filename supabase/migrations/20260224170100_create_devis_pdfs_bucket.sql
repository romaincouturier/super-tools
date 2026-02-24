-- Create devis-pdfs bucket for permanent PDF storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('devis-pdfs', 'devis-pdfs', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- RLS policies: authenticated users can read their devis PDFs
CREATE POLICY "Authenticated users can read devis PDFs"
ON storage.objects FOR SELECT
USING (bucket_id = 'devis-pdfs' AND auth.uid() IS NOT NULL);

-- Service role can insert (from edge functions)
CREATE POLICY "Service role can insert devis PDFs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'devis-pdfs');
