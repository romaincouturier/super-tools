-- Remove duplicate policies that might conflict
DROP POLICY IF EXISTS "Authenticated users can upload review images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view review images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own review images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own review images" ON storage.objects;
DROP POLICY IF EXISTS "review_images_insert" ON storage.objects;
DROP POLICY IF EXISTS "review_images_select" ON storage.objects;
DROP POLICY IF EXISTS "review_images_update" ON storage.objects;
DROP POLICY IF EXISTS "review_images_delete" ON storage.objects;

-- Recreate clean policies for review-images bucket
CREATE POLICY "review_images_insert_v2"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'review-images');

CREATE POLICY "review_images_select_v2"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'review-images');

CREATE POLICY "review_images_update_v2"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'review-images')
WITH CHECK (bucket_id = 'review-images');

CREATE POLICY "review_images_delete_v2"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'review-images');