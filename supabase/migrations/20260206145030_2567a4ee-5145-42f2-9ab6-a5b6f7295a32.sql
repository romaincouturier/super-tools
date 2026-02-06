-- Add convention tracking columns to training_participants
ALTER TABLE public.training_participants
ADD COLUMN convention_file_url TEXT,
ADD COLUMN convention_document_id TEXT;