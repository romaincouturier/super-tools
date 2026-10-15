CREATE TABLE public.lms_audio_archives (
  media_id uuid PRIMARY KEY REFERENCES public.media(id) ON DELETE CASCADE,
  course_id uuid,
  drive_file_id text,
  drive_file_name text,
  drive_folder_name text,
  archived_at timestamptz,
  last_error text,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.lms_audio_archives IS 'One row per LMS audio original copied (or attempted) to the readable Google Drive archive.';
GRANT SELECT ON public.lms_audio_archives TO authenticated;
GRANT ALL ON public.lms_audio_archives TO service_role;
ALTER TABLE public.lms_audio_archives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read audio archives" ON public.lms_audio_archives FOR SELECT TO authenticated USING (public.is_staff_user());