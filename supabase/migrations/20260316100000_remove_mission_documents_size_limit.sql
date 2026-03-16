-- Remove file size limit on mission-documents bucket
UPDATE storage.buckets
SET file_size_limit = NULL
WHERE id = 'mission-documents';
