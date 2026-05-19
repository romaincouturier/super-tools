-- ============================================================
-- learner_profiles: profile data editable by the learner
-- (name overrides, job title, avatar photo).
-- Keyed by email (same identifier used across the learner portal).
-- ============================================================

CREATE TABLE public.learner_profiles (
  email        TEXT PRIMARY KEY,
  first_name   TEXT,
  last_name    TEXT,
  fonction     TEXT,
  photo_url    TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.learner_profiles ENABLE ROW LEVEL SECURITY;

-- Anon (learners via magic link, no JWT) can read and upsert their own row.
-- Resource-level protection: the application only sends the authenticated
-- learner's own email (single-tenant, consistent with lms_messages policy).
CREATE POLICY "anon_read_learner_profiles" ON public.learner_profiles
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_insert_learner_profiles" ON public.learner_profiles
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_update_learner_profiles" ON public.learner_profiles
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "auth_manage_learner_profiles" ON public.learner_profiles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Storage bucket for learner avatar photos ──────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'learner-photos',
  'learner-photos',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "anon_upload_learner_photos" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'learner-photos');

CREATE POLICY "public_read_learner_photos" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'learner-photos');

CREATE POLICY "auth_manage_learner_photos" ON storage.objects
  FOR ALL TO authenticated USING (bucket_id = 'learner-photos') WITH CHECK (bucket_id = 'learner-photos');
