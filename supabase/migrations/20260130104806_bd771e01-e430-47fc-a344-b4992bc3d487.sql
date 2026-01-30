-- Make training-documents bucket public so uploaded files can be accessed
UPDATE storage.buckets SET public = true WHERE id = 'training-documents';