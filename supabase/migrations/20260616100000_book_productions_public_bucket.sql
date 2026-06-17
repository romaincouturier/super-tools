-- Make book-productions bucket public so getPublicUrl() works for image previews.
-- INSERT and DELETE RLS policies remain in place (owner-only).
UPDATE storage.buckets
SET public = true
WHERE id = 'book-productions';

-- Drop the SELECT policy — redundant once the bucket is public.
DROP POLICY IF EXISTS "book_productions_storage_select" ON storage.objects;
