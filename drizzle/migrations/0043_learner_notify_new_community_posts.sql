ALTER TABLE public.learner_notifications DROP CONSTRAINT IF EXISTS learner_notifications_type_check;
ALTER TABLE public.learner_notifications ADD CONSTRAINT learner_notifications_type_check
  CHECK (type IN ('live_upcoming', 'replay_available', 'community_reply', 'community_pinned', 'community_post'));

-- Apprenants qui peuvent lire une publication (même règles que la RLS de practice_posts),
-- calculées par email. Publication sans cours : aucun destinataire (pas « mes formations »).
CREATE OR REPLACE FUNCTION public.community_post_audience(_course_id uuid, _scope text, _author text)
RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH learner_courses AS (
    SELECT lower(e.learner_email) AS email, e.course_id FROM lms_enrollments e
    WHERE e.learner_email IS NOT NULL AND e.learner_email <> ''
    UNION
    SELECT lower(tp.email), t.supports_lms_course_id FROM training_participants tp
    JOIN trainings t ON t.id = tp.training_id
    WHERE t.supports_lms_course_id IS NOT NULL AND tp.email IS NOT NULL AND tp.email <> ''
  ), readers AS (
    SELECT lc.email FROM learner_courses lc WHERE lc.course_id = _course_id
    UNION
    SELECT lc.email FROM learner_courses lc
    JOIN course_community_themes mine ON mine.course_id = lc.course_id
    JOIN course_community_themes src ON src.theme_id = mine.theme_id AND src.course_id = _course_id
    WHERE public.community_theme_mode_on()
      AND (_scope = 'theme' OR (_scope IS NULL AND NOT EXISTS (SELECT 1 FROM lms_courses c WHERE c.id = _course_id AND c.community_is_private)))
  )
  SELECT DISTINCT r.email FROM readers r
  WHERE _course_id IS NOT NULL AND r.email <> lower(coalesce(_author, ''));
$$;
REVOKE ALL ON FUNCTION public.community_post_audience(uuid, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_community_new_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.learner_notifications (learner_email, type, title, body, link, reference_id)
  SELECT a, 'community_post', 'Nouvelle publication',
         left(regexp_replace(coalesce(NEW.content, ''), '\s+', ' ', 'g'), 120),
         '/espace-apprenant/pratique?post=' || NEW.id, NEW.id
  FROM public.community_post_audience(NEW.course_id, NEW.visibility_scope, NEW.author_email) a
  ON CONFLICT (learner_email, reference_id, type) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_community_new_post ON public.practice_posts;
CREATE TRIGGER trg_notify_community_new_post AFTER INSERT ON public.practice_posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_community_new_post();

-- Épinglage : même audience (plus de diffusion à tous les inscrits pour un post sans cours).
CREATE OR REPLACE FUNCTION public.notify_community_pinned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF COALESCE(OLD.is_pinned, false) = false AND COALESCE(NEW.is_pinned, false) = true THEN
    INSERT INTO public.learner_notifications (learner_email, type, title, body, link, reference_id)
    SELECT a, 'community_pinned', 'Message épinglé',
           'Un nouveau message a été épinglé dans la communauté.',
           '/espace-apprenant/pratique?post=' || NEW.id, NEW.id
    FROM public.community_post_audience(NEW.course_id, NEW.visibility_scope, NEW.author_email) a
    ON CONFLICT (learner_email, reference_id, type) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;