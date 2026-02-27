-- Remove MIME type restriction on mission-documents bucket (accept all file types)
UPDATE storage.buckets
SET allowed_mime_types = NULL
WHERE id = 'mission-documents';
