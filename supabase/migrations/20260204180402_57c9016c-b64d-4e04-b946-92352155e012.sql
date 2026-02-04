
-- Clean up duplicate policies for review-images bucket
DROP POLICY IF EXISTS "Anyone can view review images" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for review images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload review images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update review images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete review images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own review images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete review images" ON storage.objects;

-- Create clean policies for review-images
CREATE POLICY "review_images_select"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'review-images');

CREATE POLICY "review_images_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'review-images');

CREATE POLICY "review_images_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'review-images')
WITH CHECK (bucket_id = 'review-images');

CREATE POLICY "review_images_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'review-images');
