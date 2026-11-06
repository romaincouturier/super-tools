CREATE TABLE public.nocrm_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL CHECK (mode IN ('simulation','test','full')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','done','error','reconciliation_failed')),
  created_by uuid,
  leads_path text NOT NULL,
  comments_path text NOT NULL,
  lead_limit integer,
  cursor integer NOT NULL DEFAULT 0,
  total_leads integer NOT NULL DEFAULT 0,
  batches_done integer NOT NULL DEFAULT 0,
  created_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  merged_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  notes_count integer NOT NULL DEFAULT 0,
  activities_count integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  report jsonb,
  reconciliation jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT SELECT ON public.nocrm_import_runs TO authenticated;
GRANT ALL ON public.nocrm_import_runs TO service_role;
ALTER TABLE public.nocrm_import_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read nocrm import runs" ON public.nocrm_import_runs
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

ALTER TABLE public.crm_comments ADD COLUMN IF NOT EXISTS import_key text;
CREATE UNIQUE INDEX IF NOT EXISTS crm_comments_import_key_key ON public.crm_comments(import_key);

CREATE UNIQUE INDEX IF NOT EXISTS crm_cards_nocrm_id_key
  ON public.crm_cards ((source_metadata->>'nocrm_id'))
  WHERE source_metadata ? 'nocrm_id';
CREATE INDEX IF NOT EXISTS crm_cards_import_source_idx
  ON public.crm_cards ((source_metadata->>'import_source'));

CREATE POLICY "Admins upload nocrm import files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'nocrm-import' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins update nocrm import files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'nocrm-import' AND public.is_admin(auth.uid()));