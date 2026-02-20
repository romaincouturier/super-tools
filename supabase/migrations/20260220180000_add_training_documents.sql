-- Create training_documents table for generic document attachments
CREATE TABLE IF NOT EXISTS public.training_documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  training_id uuid NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size bigint,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.training_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view training documents"
ON public.training_documents FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert training documents"
ON public.training_documents FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete training documents"
ON public.training_documents FOR DELETE
USING (auth.role() = 'authenticated');
