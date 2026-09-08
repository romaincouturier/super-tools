-- Pièces jointes aux signalements (indicateur 12).
--
-- Un signalement s'accompagne souvent de preuves : capture d'écran, email
-- transféré, attestation. Elles vivent dans un bucket **privé et dédié**,
-- jamais dans un bucket existant : les politiques d'accès et la sauvegarde se
-- décident par bucket, et mélanger ces fichiers avec des supports de formation
-- reviendrait à leur appliquer les règles des supports.
--
-- Ce bucket est volontairement absent de `STORAGE_BUCKETS` dans
-- `scheduled-backup` : comme le récit, une pièce jointe nominative ne part pas
-- en copie claire dans Drive pour toute la rotation. Le registre, lui, est
-- sauvegardé et prouve le traitement.
--
-- Additive et idempotente : un bucket créé à la volée s'il manque, une table,
-- des policies protégées contre le rejeu. Aucune donnée existante n'est touchée.

INSERT INTO storage.buckets (id, name, public)
VALUES ('vhd-attachments', 'vhd-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.vhd_report_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.vhd_reports(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  -- Chemin dans le bucket privé, jamais une URL : le fichier n'est atteignable
  -- que par une URL signée à durée courte, demandée au moment de l'ouverture.
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

-- Accès au contenu des fichiers, réservé aux administrateurs. Sans ces
-- policies, le bucket privé refuse tout, y compris à eux.
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
