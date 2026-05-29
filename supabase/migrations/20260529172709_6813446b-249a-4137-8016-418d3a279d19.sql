
-- 1) Ajouter la colonne de liaison
ALTER TABLE public.practice_posts
  ADD COLUMN IF NOT EXISTS deposit_id uuid UNIQUE
    REFERENCES public.lms_work_deposits(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS practice_posts_deposit_idx
  ON public.practice_posts(deposit_id);

-- 2) Fonction de synchronisation dépôt -> publication communauté
CREATE OR REPLACE FUNCTION public.sync_deposit_to_practice_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_should_publish boolean;
  v_content text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.practice_posts WHERE deposit_id = OLD.id;
    RETURN OLD;
  END IF;

  v_should_publish := COALESCE(NEW.publication_status, '') = 'published'
                  AND COALESCE(NEW.visibility, '') = 'shared';

  v_content := NULLIF(TRIM(COALESCE(NEW.comment, '')), '');

  IF v_should_publish THEN
    INSERT INTO public.practice_posts (
      deposit_id, author_email, content, file_url, file_name, file_mime, file_size,
      course_id, lesson_id, created_at, updated_at
    )
    VALUES (
      NEW.id, lower(NEW.learner_email), v_content, NEW.file_url, NEW.file_name, NEW.file_mime, NEW.file_size,
      NEW.course_id, NEW.lesson_id, NEW.created_at, NEW.updated_at
    )
    ON CONFLICT (deposit_id) DO UPDATE SET
      content = EXCLUDED.content,
      file_url = EXCLUDED.file_url,
      file_name = EXCLUDED.file_name,
      file_mime = EXCLUDED.file_mime,
      file_size = EXCLUDED.file_size,
      course_id = EXCLUDED.course_id,
      lesson_id = EXCLUDED.lesson_id,
      updated_at = EXCLUDED.updated_at;
  ELSE
    DELETE FROM public.practice_posts WHERE deposit_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Trigger sur lms_work_deposits
DROP TRIGGER IF EXISTS trg_sync_deposit_to_practice_post ON public.lms_work_deposits;
CREATE TRIGGER trg_sync_deposit_to_practice_post
AFTER INSERT OR UPDATE OR DELETE ON public.lms_work_deposits
FOR EACH ROW
EXECUTE FUNCTION public.sync_deposit_to_practice_post();

-- 4) Backfill : pour chaque dépôt publié+partagé sans publication associée
INSERT INTO public.practice_posts (
  deposit_id, author_email, content, file_url, file_name, file_mime, file_size,
  course_id, lesson_id, created_at, updated_at
)
SELECT
  d.id, lower(d.learner_email), NULLIF(TRIM(COALESCE(d.comment, '')), ''),
  d.file_url, d.file_name, d.file_mime, d.file_size,
  d.course_id, d.lesson_id, d.created_at, d.updated_at
FROM public.lms_work_deposits d
LEFT JOIN public.practice_posts p ON p.deposit_id = d.id
WHERE d.publication_status = 'published'
  AND d.visibility = 'shared'
  AND p.id IS NULL;
