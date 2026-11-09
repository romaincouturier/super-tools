-- Contenus sociaux : notes du calendrier. Une note est un jour (date sans
-- heure ni fuseau), un texte et une couleur de la palette des thèmes. Aucun
-- lien avec un contenu, aucun statut. Tout utilisateur du module les gère.

CREATE TABLE IF NOT EXISTS public.social_calendar_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day DATE NOT NULL,
  text TEXT NOT NULL,
  color TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Blancs : même classe que social_themes_name_not_blank (String.prototype.trim).
ALTER TABLE public.social_calendar_notes DROP CONSTRAINT IF EXISTS social_calendar_notes_text_not_blank;
ALTER TABLE public.social_calendar_notes ADD CONSTRAINT social_calendar_notes_text_not_blank
  CHECK (text !~ '^[[:space:]   -​    　﻿]*$');

ALTER TABLE public.social_calendar_notes DROP CONSTRAINT IF EXISTS social_calendar_notes_text_length;
ALTER TABLE public.social_calendar_notes ADD CONSTRAINT social_calendar_notes_text_length
  CHECK (char_length(text) <= 500);

-- Palette des thèmes (THEME_COLORS de src/services/socialContents.ts).
ALTER TABLE public.social_calendar_notes DROP CONSTRAINT IF EXISTS social_calendar_notes_color_palette;
ALTER TABLE public.social_calendar_notes ADD CONSTRAINT social_calendar_notes_color_palette
  CHECK (color IN ('#6b7280', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'));

CREATE INDEX IF NOT EXISTS social_calendar_notes_day_idx ON public.social_calendar_notes (day);

DROP TRIGGER IF EXISTS social_calendar_notes_updated_at ON public.social_calendar_notes;
CREATE TRIGGER social_calendar_notes_updated_at
  BEFORE UPDATE ON public.social_calendar_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auteur : posé par la base à la création (auth.uid()), figé ensuite. Ni
-- l'insertion ni la modification ne peuvent l'attribuer à quelqu'un d'autre.
CREATE OR REPLACE FUNCTION public.social_calendar_notes_set_created_by()
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

DROP TRIGGER IF EXISTS social_calendar_notes_created_by ON public.social_calendar_notes;
CREATE TRIGGER social_calendar_notes_created_by
  BEFORE INSERT OR UPDATE ON public.social_calendar_notes
  FOR EACH ROW EXECUTE FUNCTION public.social_calendar_notes_set_created_by();

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE public.social_calendar_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_calendar_notes_module_select ON public.social_calendar_notes;
CREATE POLICY social_calendar_notes_module_select ON public.social_calendar_notes
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt_fr'));

DROP POLICY IF EXISTS social_calendar_notes_module_insert ON public.social_calendar_notes;
CREATE POLICY social_calendar_notes_module_insert ON public.social_calendar_notes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt_fr'));

DROP POLICY IF EXISTS social_calendar_notes_module_update ON public.social_calendar_notes;
CREATE POLICY social_calendar_notes_module_update ON public.social_calendar_notes
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt_fr'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt_fr'));

DROP POLICY IF EXISTS social_calendar_notes_module_delete ON public.social_calendar_notes;
CREATE POLICY social_calendar_notes_module_delete ON public.social_calendar_notes
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt_fr'));
