-- Fix storage policies for training-documents bucket
-- This migration ensures proper RLS policies for file uploads

-- First, drop ALL possible policy names that might exist for this bucket
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE tablename = 'objects'
        AND schemaname = 'storage'
        AND (policyname ILIKE '%training%document%' OR policyname ILIKE '%training_document%')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
    END LOOP;
END $$;

-- Ensure bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('training-documents', 'training-documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Create storage policies with unique names
CREATE POLICY "td_authenticated_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'training-documents');

CREATE POLICY "td_authenticated_select"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'training-documents');

CREATE POLICY "td_authenticated_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'training-documents')
WITH CHECK (bucket_id = 'training-documents');

CREATE POLICY "td_authenticated_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'training-documents');

CREATE POLICY "td_public_select"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'training-documents');

