-- Increase training-supports bucket size limit from 50 MB to 200 MB
-- iPad videos (especially 4K) can easily exceed 50 MB
UPDATE storage.buckets
SET file_size_limit = 209715200
WHERE id = 'training-supports';
