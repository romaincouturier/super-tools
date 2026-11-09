ALTER TABLE public.training_evaluations
  ADD COLUMN IF NOT EXISTS site_comment_published_at timestamptz,
  ADD COLUMN IF NOT EXISTS site_comment_published_by uuid;

-- Cocher l'action « commentaire à créer sur le site » marque l'évaluation comme publiée.
CREATE OR REPLACE FUNCTION public.daily_action_marks_site_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.category = 'commentaires_site' AND NEW.entity_type = 'training_evaluation'
     AND NEW.is_completed AND NOT COALESCE(OLD.is_completed, false) AND NOT COALESCE(NEW.auto_completed, false)
     AND NEW.entity_id IS NOT NULL THEN
    UPDATE public.training_evaluations
       SET site_comment_published_at = now(), site_comment_published_by = NEW.user_id
     WHERE id::text = NEW.entity_id::text AND site_comment_published_at IS NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_daily_action_marks_site_comment ON public.daily_actions;
CREATE TRIGGER trg_daily_action_marks_site_comment AFTER UPDATE OF is_completed ON public.daily_actions
  FOR EACH ROW EXECUTE FUNCTION public.daily_action_marks_site_comment();

-- Une évaluation marquée publiée (depuis n'importe quel écran) clôt ses actions ouvertes.
CREATE OR REPLACE FUNCTION public.site_comment_closes_daily_actions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.site_comment_published_at IS NOT NULL AND OLD.site_comment_published_at IS NULL THEN
    UPDATE public.daily_actions
       SET is_completed = true, completed_at = now(), auto_completed = true
     WHERE category = 'commentaires_site' AND entity_type = 'training_evaluation'
       AND entity_id::text = NEW.id::text AND NOT is_completed;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_site_comment_closes_daily_actions ON public.training_evaluations;
CREATE TRIGGER trg_site_comment_closes_daily_actions AFTER UPDATE OF site_comment_published_at ON public.training_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.site_comment_closes_daily_actions();