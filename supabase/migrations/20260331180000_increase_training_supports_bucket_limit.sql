-- Remove file size limit on training-supports bucket.
-- Large videos (iPad 4K) are uploaded via TUS resumable protocol (chunked),
-- so the bucket limit is no longer the gatekeeper — the Supabase plan limit applies.
UPDATE storage.buckets
SET file_size_limit = NULL
WHERE id = 'training-supports';
