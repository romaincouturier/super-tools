ALTER TABLE public.testimonials
  ALTER COLUMN drive_file_id DROP NOT NULL;

ALTER TABLE public.testimonials
  ADD COLUMN IF NOT EXISTS video_url TEXT;
