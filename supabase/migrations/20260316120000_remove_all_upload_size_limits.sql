-- Remove file size limits on all storage buckets
UPDATE storage.buckets
SET file_size_limit = NULL
WHERE id IN (
  'mission-media',
  'training-media',
  'certificates',
  'crm-attachments',
  'review-images',
  'support-attachments',
  'media',
  'devis-pdfs'
);
