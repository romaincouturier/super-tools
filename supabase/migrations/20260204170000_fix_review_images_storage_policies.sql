-- Fix storage policies for review-images bucket
-- Add UPDATE policy which is required by Supabase Storage for completing uploads

-- Ensure bucket exists and is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'review-images',
  'review-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies if they exist (to recreate them properly)
DROP POLICY IF EXISTS "Public read access for review images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload review images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete review images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update review images" ON storage.objects;

-- Allow public read access
CREATE POLICY "Public read access for review images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'review-images');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload review images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'review-images');

-- Allow authenticated users to update (needed for completing uploads)
CREATE POLICY "Authenticated users can update review images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'review-images')
WITH CHECK (bucket_id = 'review-images');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete review images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'review-images');
