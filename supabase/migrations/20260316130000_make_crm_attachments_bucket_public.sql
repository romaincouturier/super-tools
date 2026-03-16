-- Make crm-attachments bucket public so pasted images display correctly
-- Images pasted in the CRM description editor use getPublicUrl() which requires a public bucket
UPDATE storage.buckets SET public = true WHERE id = 'crm-attachments';
