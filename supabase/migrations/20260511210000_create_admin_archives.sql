-- Module Archive Administrative
-- Stockage intelligent de documents administratifs avec analyse IA automatique.

-- ── 1. Enum module ───────────────────────────────────────────────────────────
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'archives';

-- ── 2. Table admin_documents ─────────────────────────────────────────────────
CREATE TABLE public.admin_documents (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  file_url       text        NOT NULL,
  file_name      text        NOT NULL,
  file_size      bigint,
  mime_type      text,
  year           integer,
  category       text,
  tags           text[]      DEFAULT '{}',
  summary        text,
  analysis_status text       DEFAULT 'pending'
                             CHECK (analysis_status IN ('pending', 'done', 'failed')),
  uploaded_at    timestamptz DEFAULT now(),
  analyzed_at    timestamptz
);

ALTER TABLE public.admin_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_documents_select ON public.admin_documents
  FOR SELECT TO authenticated USING (true);

CREATE POLICY admin_documents_insert ON public.admin_documents
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY admin_documents_update ON public.admin_documents
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY admin_documents_delete ON public.admin_documents
  FOR DELETE TO authenticated USING (true);

-- ── 3. Bucket admin-archives ─────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'admin-archives',
  'admin-archives',
  true,
  104857600, -- 100 MB
  NULL
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY admin_archives_select ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'admin-archives');

CREATE POLICY admin_archives_insert ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'admin-archives');

CREATE POLICY admin_archives_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'admin-archives')
  WITH CHECK (bucket_id = 'admin-archives');

CREATE POLICY admin_archives_delete ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'admin-archives');
