-- Add SVG MIME type to mission-documents bucket so SVG files can be uploaded
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp',
  'image/svg+xml'
]
WHERE id = 'mission-documents';
