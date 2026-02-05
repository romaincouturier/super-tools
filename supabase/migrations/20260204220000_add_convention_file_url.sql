-- Add convention_file_url column to trainings table
ALTER TABLE public.trainings
ADD COLUMN IF NOT EXISTS convention_file_url text;

-- Add comment
COMMENT ON COLUMN public.trainings.convention_file_url IS 'URL of the generated convention de formation PDF';
