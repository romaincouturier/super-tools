-- Allow document uploads (PDF, Word, Excel, etc.) in the mission-media bucket.
-- The bucket was originally created for images/videos only, which caused PDF
-- uploads to be rejected by Supabase storage with a MIME type error.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp',
  'image/heic', 'image/heif',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv'
]
WHERE id = 'mission-media';
