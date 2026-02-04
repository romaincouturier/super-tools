-- Drop existing policies and recreate them correctly
DROP POLICY IF EXISTS "Authenticated users can upload review images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view review images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own review images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete review images" ON storage.objects;

-- Recreate policies with proper conditions
CREATE POLICY "Authenticated users can upload review images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'review-images');

CREATE POLICY "Anyone can view review images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'review-images');

CREATE POLICY "Users can update their own review images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'review-images');

CREATE POLICY "Users can delete review images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'review-images');