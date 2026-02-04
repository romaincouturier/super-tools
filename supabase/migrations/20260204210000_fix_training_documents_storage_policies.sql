-- Fix storage policies for training-documents bucket
-- Drop existing policies if they exist (ignore errors)
DROP POLICY IF EXISTS "Authenticated users can upload training documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view training documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete training documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update training documents" ON storage.objects;

-- Ensure bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('training-documents', 'training-documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Recreate storage policies for training documents bucket
CREATE POLICY "training_documents_insert_policy"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'training-documents');

CREATE POLICY "training_documents_select_policy"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'training-documents');

CREATE POLICY "training_documents_delete_policy"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'training-documents');

CREATE POLICY "training_documents_update_policy"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'training-documents')
WITH CHECK (bucket_id = 'training-documents');

-- Allow public read access since bucket is public
CREATE POLICY "training_documents_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'training-documents');
