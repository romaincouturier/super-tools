
CREATE TABLE IF NOT EXISTS public.participant_files (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id uuid NOT NULL REFERENCES public.training_participants(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.participant_files ENABLE ROW LEVEL SECURITY;

DO $do$ BEGIN
  CREATE POLICY "Authenticated users can view participant files"
    ON public.participant_files FOR SELECT
    USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

DO $do$ BEGIN
  CREATE POLICY "Authenticated users can insert participant files"
    ON public.participant_files FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

DO $do$ BEGIN
  CREATE POLICY "Authenticated users can delete participant files"
    ON public.participant_files FOR DELETE
    USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;