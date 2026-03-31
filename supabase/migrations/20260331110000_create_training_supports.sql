-- ============================================================
-- Training Supports — Structured training materials
-- ============================================================

-- 1. Support templates (reusable models)
CREATE TABLE IF NOT EXISTS public.training_support_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Template sections
CREATE TABLE IF NOT EXISTS public.training_support_template_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.training_support_templates(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_template_sections_template ON public.training_support_template_sections (template_id, position);

-- 3. Training supports (one per training)
CREATE TABLE IF NOT EXISTS public.training_supports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id uuid NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Support de formation',
  template_id uuid REFERENCES public.training_support_templates(id) ON DELETE SET NULL,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (training_id)
);

CREATE INDEX idx_training_supports_training ON public.training_supports (training_id);

-- 4. Support sections
CREATE TABLE IF NOT EXISTS public.training_support_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  support_id uuid NOT NULL REFERENCES public.training_supports(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',         -- HTML content (Tiptap)
  position integer NOT NULL DEFAULT 0,
  is_resources boolean NOT NULL DEFAULT false,  -- permanent "Ressources" section
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_sections_support ON public.training_support_sections (support_id, position);

-- 5. Section media (images, videos, audio per section)
CREATE TABLE IF NOT EXISTS public.training_support_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.training_support_sections(id) ON DELETE CASCADE,
  support_id uuid NOT NULL REFERENCES public.training_supports(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('image', 'video', 'audio')),
  mime_type text,
  file_size bigint,
  transcript text,                               -- audio transcription
  transcript_summary text,                       -- AI summary of transcription
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_media_section ON public.training_support_media (section_id, position);
CREATE INDEX idx_support_media_support ON public.training_support_media (support_id);

-- 6. Bulk import staging (images/videos not yet assigned to sections)
CREATE TABLE IF NOT EXISTS public.training_support_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  support_id uuid NOT NULL REFERENCES public.training_supports(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('image', 'video')),
  mime_type text,
  file_size bigint,
  assigned_section_id uuid REFERENCES public.training_support_sections(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_imports_support ON public.training_support_imports (support_id);
CREATE INDEX idx_support_imports_unassigned ON public.training_support_imports (support_id)
  WHERE assigned_section_id IS NULL;

-- 7. Storage bucket for support files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'training-supports',
  'training-supports',
  true,
  52428800,
  ARRAY[
    'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
    'video/mp4', 'video/webm', 'video/quicktime',
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/x-m4a', 'audio/mp3'
  ]
) ON CONFLICT (id) DO NOTHING;

-- 8. RLS policies
ALTER TABLE public.training_support_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_support_template_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_supports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_support_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_support_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_support_imports ENABLE ROW LEVEL SECURITY;

-- Templates: all authenticated users
CREATE POLICY "tpl_select" ON public.training_support_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "tpl_insert" ON public.training_support_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "tpl_update" ON public.training_support_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tpl_delete" ON public.training_support_templates FOR DELETE TO authenticated USING (true);

CREATE POLICY "tpl_sec_select" ON public.training_support_template_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "tpl_sec_insert" ON public.training_support_template_sections FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "tpl_sec_update" ON public.training_support_template_sections FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tpl_sec_delete" ON public.training_support_template_sections FOR DELETE TO authenticated USING (true);

-- Supports: all authenticated users
CREATE POLICY "sup_select" ON public.training_supports FOR SELECT TO authenticated USING (true);
CREATE POLICY "sup_insert" ON public.training_supports FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sup_update" ON public.training_supports FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sup_delete" ON public.training_supports FOR DELETE TO authenticated USING (true);

CREATE POLICY "sec_select" ON public.training_support_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "sec_insert" ON public.training_support_sections FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sec_update" ON public.training_support_sections FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sec_delete" ON public.training_support_sections FOR DELETE TO authenticated USING (true);

CREATE POLICY "media_select" ON public.training_support_media FOR SELECT TO authenticated USING (true);
CREATE POLICY "media_insert" ON public.training_support_media FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "media_update" ON public.training_support_media FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "media_delete" ON public.training_support_media FOR DELETE TO authenticated USING (true);

CREATE POLICY "import_select" ON public.training_support_imports FOR SELECT TO authenticated USING (true);
CREATE POLICY "import_insert" ON public.training_support_imports FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "import_update" ON public.training_support_imports FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "import_delete" ON public.training_support_imports FOR DELETE TO authenticated USING (true);

-- Storage policies
CREATE POLICY "ts_storage_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'training-supports');
CREATE POLICY "ts_storage_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'training-supports');
CREATE POLICY "ts_storage_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'training-supports');

-- Public read access for training supports (participants view)
CREATE POLICY "sup_public_select" ON public.training_supports FOR SELECT TO anon USING (is_published = true);
CREATE POLICY "sec_public_select" ON public.training_support_sections FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.training_supports WHERE id = support_id AND is_published = true));
CREATE POLICY "media_public_select" ON public.training_support_media FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.training_supports WHERE id = support_id AND is_published = true));
CREATE POLICY "ts_storage_public_select" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'training-supports');
