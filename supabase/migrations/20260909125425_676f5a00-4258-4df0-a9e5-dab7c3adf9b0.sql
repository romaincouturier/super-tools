-- 20260908130000_vhd_report_attachments.sql (bucket créé via l'API Storage)
CREATE TABLE IF NOT EXISTS public.vhd_report_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.vhd_reports(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  content_type text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vhd_report_attachments_report
  ON public.vhd_report_attachments(report_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.vhd_report_attachments TO authenticated;
GRANT ALL ON public.vhd_report_attachments TO service_role;

ALTER TABLE public.vhd_report_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vhd_report_attachments_admin ON public.vhd_report_attachments;
CREATE POLICY vhd_report_attachments_admin ON public.vhd_report_attachments
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS vhd_attachments_read ON storage.objects;
CREATE POLICY vhd_attachments_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'vhd-attachments' AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS vhd_attachments_write ON storage.objects;
CREATE POLICY vhd_attachments_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vhd-attachments' AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS vhd_attachments_delete ON storage.objects;
CREATE POLICY vhd_attachments_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'vhd-attachments' AND public.is_admin(auth.uid()));

COMMENT ON TABLE public.vhd_report_attachments IS
  'Pièces jointes d''un signalement, dans le bucket privé vhd-attachments. Exclu de la sauvegarde Drive, comme le récit.';