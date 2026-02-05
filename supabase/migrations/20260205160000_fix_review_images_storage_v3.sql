-- Comprehensive fix for review-images storage policies
-- Drop ALL known policy names from previous migrations to ensure clean state

DO $$
DECLARE
  pol RECORD;
BEGIN
  -- Drop all policies that reference review-images bucket
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND (
      policyname LIKE '%review_image%'
      OR policyname LIKE '%review image%'
      OR policyname LIKE '%review-image%'
    )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Ensure bucket exists and is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'review-images',
  'review-images',
  true,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];

-- Recreate clean policies
CREATE POLICY "review_img_select_v3"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'review-images');

CREATE POLICY "review_img_insert_v3"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'review-images');

CREATE POLICY "review_img_update_v3"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'review-images')
WITH CHECK (bucket_id = 'review-images');

CREATE POLICY "review_img_delete_v3"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'review-images');
