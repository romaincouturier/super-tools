-- Contenus sociaux, suites de relecture de la PR #484.
-- 1. Auteur des contenus et des thèmes posé par la base (auth.uid()) et figé
--    ensuite, comme pour les notes : un utilisateur du module ne peut plus
--    créer ni modifier un contenu ou un thème au nom de quelqu'un d'autre.
-- 2. Couleur des notes : format hexadécimal minuscule, comme les thèmes, au
--    lieu de la liste figée de la palette, qui couplait la base au front.

CREATE OR REPLACE FUNCTION public.social_set_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
  ELSE
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS social_content_groups_created_by ON public.social_content_groups;
CREATE TRIGGER social_content_groups_created_by
  BEFORE INSERT OR UPDATE ON public.social_content_groups
  FOR EACH ROW EXECUTE FUNCTION public.social_set_created_by();

DROP TRIGGER IF EXISTS social_themes_created_by ON public.social_themes;
CREATE TRIGGER social_themes_created_by
  BEFORE INSERT OR UPDATE ON public.social_themes
  FOR EACH ROW EXECUTE FUNCTION public.social_set_created_by();

ALTER TABLE public.social_calendar_notes DROP CONSTRAINT IF EXISTS social_calendar_notes_color_palette;
ALTER TABLE public.social_calendar_notes DROP CONSTRAINT IF EXISTS social_calendar_notes_color_format;
ALTER TABLE public.social_calendar_notes ADD CONSTRAINT social_calendar_notes_color_format
  CHECK (color ~ '^#[0-9a-f]{6}$');
