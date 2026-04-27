-- Stage 1 of the lesson blocks refactor.
-- Each lesson can carry an ordered list of typed content blocks. Existing
-- lessons are backfilled with a single block representing their current
-- monolithic content so the player keeps working unchanged.

CREATE TABLE IF NOT EXISTS public.lms_lesson_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lms_lessons(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  hidden BOOLEAN NOT NULL DEFAULT false,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lms_lesson_blocks_lesson_position_idx
  ON public.lms_lesson_blocks (lesson_id, position);

ALTER TABLE public.lms_lesson_blocks ENABLE ROW LEVEL SECURITY;

-- Authenticated back-office users have full CRUD (mirrors lms_lessons policy).
CREATE POLICY "auth_manage_lesson_blocks"
  ON public.lms_lesson_blocks
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Anonymous learners can read blocks of lessons that belong to a published course.
CREATE POLICY "anon_read_lesson_blocks"
  ON public.lms_lesson_blocks
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1
    FROM public.lms_lessons l
    JOIN public.lms_modules m ON m.id = l.module_id
    JOIN public.lms_courses c ON c.id = m.course_id
    WHERE l.id = lms_lesson_blocks.lesson_id
      AND c.is_published = true
  ));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_lms_lesson_blocks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lms_lesson_blocks_updated_at
  BEFORE UPDATE ON public.lms_lesson_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_lms_lesson_blocks_updated_at();

-- Backfill: one block per existing lesson, mapping the legacy fields into the
-- block content jsonb. Skips lessons that already have at least one block.
INSERT INTO public.lms_lesson_blocks (lesson_id, type, position, content)
SELECT
  l.id,
  l.lesson_type,
  0,
  CASE l.lesson_type
    WHEN 'text' THEN jsonb_build_object('html', COALESCE(l.content_html, ''))
    WHEN 'video' THEN jsonb_build_object(
      'url', l.video_url,
      'duration_seconds', l.video_duration_seconds
    )
    WHEN 'image' THEN jsonb_build_object(
      'url', l.image_url,
      'caption_html', l.content_html
    )
    WHEN 'file' THEN jsonb_build_object(
      'url', l.file_url,
      'name', l.file_name,
      'size', l.file_size,
      'description_html', l.content_html
    )
    WHEN 'quiz' THEN jsonb_build_object('quiz_id', l.quiz_id)
    WHEN 'assignment' THEN jsonb_build_object(
      'assignment_id', l.assignment_id,
      'instructions_html', l.content_html
    )
    ELSE jsonb_build_object('html', COALESCE(l.content_html, ''))
  END
FROM public.lms_lessons l
WHERE NOT EXISTS (
  SELECT 1 FROM public.lms_lesson_blocks b WHERE b.lesson_id = l.id
);
