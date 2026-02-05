-- Ensure the review-images bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('review-images', 'review-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can upload review images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view review images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own review images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own review images" ON storage.objects;

-- Allow authenticated users to upload images to the review-images bucket
CREATE POLICY "Authenticated users can upload review images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'review-images');

-- Allow anyone to view images in the review-images bucket (public bucket)
CREATE POLICY "Anyone can view review images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'review-images');

-- Allow users to update their own uploaded images
CREATE POLICY "Users can update their own review images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'review-images');

-- Allow users to delete their own uploaded images
CREATE POLICY "Users can delete their own review images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'review-images');