-- ST-2026-0201 — Centre de notifications in-app pour les apprenants
-- Table des notifications affichees dans la cloche du portail apprenant.
-- Les notifications sont creees par des fonctions cote serveur (service role) et
-- par le trigger de mise a disposition d'un replay. L'apprenant (role anon,
-- identifie par l'en-tete x-learner-email) lit et marque comme lues ses propres
-- notifications.

CREATE TABLE IF NOT EXISTS public.learner_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_email text NOT NULL,
  type text NOT NULL CHECK (type IN ('live_upcoming', 'replay_available')),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  link text,
  reference_id uuid,                       -- training_live_meetings.id
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learner_notifications_email
  ON public.learner_notifications (learner_email, created_at DESC);

-- Empeche les doublons (rerun de cron, double mise a jour du replay).
-- learner_email est toujours stocke en minuscules par les producteurs.
CREATE UNIQUE INDEX IF NOT EXISTS uq_learner_notifications_dedup
  ON public.learner_notifications (learner_email, reference_id, type);

ALTER TABLE public.learner_notifications ENABLE ROW LEVEL SECURITY;

-- L'apprenant lit ses propres notifications (validation via get_learner_email()).
CREATE POLICY "anon_read_own_learner_notifications" ON public.learner_notifications
  FOR SELECT TO anon
  USING (learner_email = get_learner_email());

-- L'apprenant marque ses notifications comme lues.
CREATE POLICY "anon_update_own_learner_notifications" ON public.learner_notifications
  FOR UPDATE TO anon
  USING (learner_email = get_learner_email())
  WITH CHECK (learner_email = get_learner_email());

-- Le staff (authentifie) peut consulter les notifications.
CREATE POLICY "staff_read_learner_notifications" ON public.learner_notifications
  FOR SELECT TO authenticated
  USING (true);

-- ── Trigger : replay disponible ──────────────────────────────────────────────
-- Quand replay_url passe de vide a renseigne sur un live, notifie chaque
-- participant de la formation.
CREATE OR REPLACE FUNCTION public.notify_replay_available()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF COALESCE(OLD.replay_url, '') = '' AND COALESCE(NEW.replay_url, '') <> '' THEN
    INSERT INTO public.learner_notifications (learner_email, type, title, body, reference_id)
    SELECT
      lower(tp.email),
      'replay_available',
      'Replay disponible',
      'Le replay du live "' || COALESCE(NEW.title, 'Live collectif') || '" est disponible.',
      NEW.id
    FROM public.training_participants tp
    WHERE tp.training_id = NEW.training_id
      AND tp.email IS NOT NULL
      AND tp.email <> ''
    ON CONFLICT (learner_email, reference_id, type) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_replay_available ON public.training_live_meetings;
CREATE TRIGGER trg_notify_replay_available
  AFTER UPDATE OF replay_url ON public.training_live_meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_replay_available();
