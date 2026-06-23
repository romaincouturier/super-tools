-- Ajoute le type 'community_reply' aux notifications in-app apprenant : quand
-- quelqu'un commente une publication de l'apprenant dans la communaute.
ALTER TABLE public.learner_notifications
  DROP CONSTRAINT IF EXISTS learner_notifications_type_check;

ALTER TABLE public.learner_notifications
  ADD CONSTRAINT learner_notifications_type_check
  CHECK (type IN ('live_upcoming', 'replay_available', 'community_reply'));
