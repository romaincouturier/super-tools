UPDATE storage.buckets 
SET allowed_mime_types = array_append(allowed_mime_types, 'image/svg+xml')
WHERE id = 'media';