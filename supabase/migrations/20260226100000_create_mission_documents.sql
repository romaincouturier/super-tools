-- Mission documents: contractual files (bon de commande, contrat, convention, etc.)

CREATE TABLE IF NOT EXISTS public.mission_documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size bigint,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.mission_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view mission documents"
  ON public.mission_documents FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert mission documents"
  ON public.mission_documents FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete mission documents"
  ON public.mission_documents FOR DELETE
  USING (auth.role() = 'authenticated');

CREATE INDEX idx_mission_documents_mission_id ON public.mission_documents(mission_id);

-- Storage bucket for mission documents (PDF, Word, Excel, images)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mission-documents',
  'mission-documents',
  true,
  20971520, -- 20 MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png', 'image/jpeg', 'image/jpg', 'image/webp'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "mission_documents_select"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'mission-documents');

CREATE POLICY "mission_documents_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mission-documents');

CREATE POLICY "mission_documents_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'mission-documents')
  WITH CHECK (bucket_id = 'mission-documents');

CREATE POLICY "mission_documents_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'mission-documents');
