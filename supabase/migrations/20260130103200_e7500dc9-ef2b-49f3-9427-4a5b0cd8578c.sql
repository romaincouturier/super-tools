-- Add document columns to trainings table
ALTER TABLE public.trainings
ADD COLUMN invoice_file_url text,
ADD COLUMN attendance_sheets_urls text[] DEFAULT '{}';

-- Create storage bucket for training documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('training-documents', 'training-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for training documents bucket
CREATE POLICY "Authenticated users can upload training documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'training-documents');

CREATE POLICY "Authenticated users can view training documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'training-documents');

CREATE POLICY "Authenticated users can delete training documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'training-documents');

CREATE POLICY "Authenticated users can update training documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'training-documents');