-- Notification apprenant : un message a été épinglé dans la communauté.
-- Complète la notification "commentaire sur ma publication" (community_reply)
-- déjà en place. Les deux sont les seules notifications communautaires
-- pertinentes pour l'apprenant.

ALTER TABLE public.learner_notifications
  DROP CONSTRAINT IF EXISTS learner_notifications_type_check;

ALTER TABLE public.learner_notifications
  ADD CONSTRAINT learner_notifications_type_check
  CHECK (type IN ('live_upcoming', 'replay_available', 'community_reply', 'community_pinned'));

-- Quand un post passe à épinglé (is_pinned false -> true), notifie les
-- apprenants inscrits au cours de la communauté (ou tous les inscrits si le
-- post n'est pas rattaché à un cours), sauf l'auteur du message.
CREATE OR REPLACE FUNCTION public.notify_community_pinned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF COALESCE(OLD.is_pinned, false) = false AND COALESCE(NEW.is_pinned, false) = true THEN
    INSERT INTO public.learner_notifications (learner_email, type, title, body, link, reference_id)
    SELECT DISTINCT
      lower(e.learner_email),
      'community_pinned',
      'Message épinglé',
      'Un nouveau message a été épinglé dans la communauté.',
      '/espace-apprenant/pratique?post=' || NEW.id,
      NEW.id
    FROM public.lms_enrollments e
    WHERE (NEW.course_id IS NULL OR e.course_id = NEW.course_id)
      AND e.learner_email IS NOT NULL
      AND e.learner_email <> ''
      AND lower(e.learner_email) <> lower(NEW.author_email)
    ON CONFLICT (learner_email, reference_id, type) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_community_pinned ON public.practice_posts;
CREATE TRIGGER trg_notify_community_pinned
  AFTER UPDATE OF is_pinned ON public.practice_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_community_pinned();
