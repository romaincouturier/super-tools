
-- Add is_deliverable flag to mission_documents
ALTER TABLE public.mission_documents ADD COLUMN is_deliverable boolean NOT NULL DEFAULT false;

-- Add is_deliverable flag to media table
ALTER TABLE public.media ADD COLUMN is_deliverable boolean NOT NULL DEFAULT false;
