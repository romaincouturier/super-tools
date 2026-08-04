ALTER TABLE public.tender_opportunities
  ADD COLUMN IF NOT EXISTS ai_summary jsonb,
  ADD COLUMN IF NOT EXISTS ai_summary_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_summary_model text;

COMMENT ON COLUMN public.tender_opportunities.ai_summary IS
  'Synthèse produite à partir de l''avis : objet reformulé, attendus, critères, points de vigilance, adéquation au métier. Calculée à la demande, jamais à l''ingestion.';

CREATE TABLE IF NOT EXISTS public.tender_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id uuid NOT NULL REFERENCES public.tender_opportunities(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid,
  ai_analysis jsonb,
  ai_analysis_at timestamptz,
  ai_analysis_model text,
  ai_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tender_documents TO authenticated;
GRANT ALL ON public.tender_documents TO service_role;

CREATE INDEX IF NOT EXISTS idx_tender_documents_tender
  ON public.tender_documents (tender_id, created_at DESC);

ALTER TABLE public.tender_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tender_documents_select" ON public.tender_documents;
CREATE POLICY "tender_documents_select" ON public.tender_documents
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "tender_documents_insert" ON public.tender_documents;
CREATE POLICY "tender_documents_insert" ON public.tender_documents
  FOR INSERT TO authenticated WITH CHECK (public.has_crm_access(auth.uid()));

DROP POLICY IF EXISTS "tender_documents_update" ON public.tender_documents;
CREATE POLICY "tender_documents_update" ON public.tender_documents
  FOR UPDATE TO authenticated USING (public.has_crm_access(auth.uid()));

DROP POLICY IF EXISTS "tender_documents_delete" ON public.tender_documents;
CREATE POLICY "tender_documents_delete" ON public.tender_documents
  FOR DELETE TO authenticated USING (public.has_crm_access(auth.uid()));

DROP POLICY IF EXISTS staff_only_select ON public.tender_documents;
CREATE POLICY staff_only_select ON public.tender_documents
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.is_staff_user());

DROP POLICY IF EXISTS "tender_documents_storage_select" ON storage.objects;
CREATE POLICY "tender_documents_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'tender-documents' AND public.is_staff_user());

DROP POLICY IF EXISTS "tender_documents_storage_insert" ON storage.objects;
CREATE POLICY "tender_documents_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tender-documents' AND public.has_crm_access(auth.uid()));

DROP POLICY IF EXISTS "tender_documents_storage_delete" ON storage.objects;
CREATE POLICY "tender_documents_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'tender-documents' AND public.has_crm_access(auth.uid()));