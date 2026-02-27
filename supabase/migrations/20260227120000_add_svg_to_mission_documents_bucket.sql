-- Remove MIME type restriction on mission-documents bucket (accept all file types)
UPDATE storage.buckets
SET allowed_mime_types = NULL
WHERE id = 'mission-documents';

-- Add SVG to media bucket so SVG images can be uploaded alongside photos/videos
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp',
  'image/heic', 'image/heif', 'image/svg+xml',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'
]
WHERE id = 'media';
