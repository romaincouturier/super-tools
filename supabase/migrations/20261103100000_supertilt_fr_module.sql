-- Nouveau module supertilt.fr (Newsletter, Transcripts, Témoignages, Projets)
-- et renommage du module SuperTilt en Projets transverses.

-- ── 1. Droits par module ───────────────────────────────────────
-- Un seul droit par module : contenu devient supertilt_fr et absorbe
-- transcripts et temoignages ; supertilt devient projets_transverses.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.app_module'::regtype AND enumlabel = 'contenu'
  ) THEN
    ALTER TYPE public.app_module RENAME VALUE 'contenu' TO 'supertilt_fr';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.app_module'::regtype AND enumlabel = 'supertilt'
  ) THEN
    ALTER TYPE public.app_module RENAME VALUE 'supertilt' TO 'projets_transverses';
  END IF;
END $$;

INSERT INTO public.user_module_access (user_id, module, granted_by, granted_at)
SELECT DISTINCT ON (user_id) user_id, 'supertilt_fr'::public.app_module, granted_by, now()
FROM public.user_module_access
WHERE module IN ('transcripts', 'temoignages')
ORDER BY user_id
ON CONFLICT (user_id, module) DO NOTHING;

DELETE FROM public.user_module_access WHERE module IN ('transcripts', 'temoignages');

-- Les politiques RLS existantes passent encore les anciennes clés en texte :
-- on les traduit ici plutôt que de réécrire chaque politique.
CREATE OR REPLACE FUNCTION public.has_module_access(_user_id uuid, _module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_module_access
    WHERE user_id = _user_id
      AND module = (CASE _module
        WHEN 'contenu' THEN 'supertilt_fr'
        WHEN 'transcripts' THEN 'supertilt_fr'
        WHEN 'temoignages' THEN 'supertilt_fr'
        WHEN 'supertilt' THEN 'projets_transverses'
        ELSE _module
      END)::app_module
  )
  OR EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id AND email = 'romain@supertilt.fr'
  )
$$;

-- ── 2. Deux kanbans sur les mêmes tables ───────────────────────
-- board = 'transverse' : Projets transverses ; board = 'site' : supertilt.fr / Projets.
ALTER TABLE public.supertilt_columns
  ADD COLUMN IF NOT EXISTS board text NOT NULL DEFAULT 'transverse'
  CHECK (board IN ('transverse', 'site'));
ALTER TABLE public.supertilt_actions
  ADD COLUMN IF NOT EXISTS board text NOT NULL DEFAULT 'transverse'
  CHECK (board IN ('transverse', 'site'));

CREATE INDEX IF NOT EXISTS idx_supertilt_columns_board ON public.supertilt_columns(board);
CREATE INDEX IF NOT EXISTS idx_supertilt_actions_board ON public.supertilt_actions(board);

CREATE OR REPLACE FUNCTION public.can_access_project_board(_user_id uuid, _board text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin(_user_id)
    OR public.has_module_access(
      _user_id,
      CASE _board WHEN 'site' THEN 'supertilt_fr' ELSE 'projets_transverses' END
    )
$$;

DROP POLICY IF EXISTS "Supertilt members can view actions" ON public.supertilt_actions;
DROP POLICY IF EXISTS "Supertilt members can insert actions" ON public.supertilt_actions;
DROP POLICY IF EXISTS "Supertilt members can update actions" ON public.supertilt_actions;
DROP POLICY IF EXISTS "Supertilt members can delete actions" ON public.supertilt_actions;
DROP POLICY IF EXISTS "Supertilt members can view columns" ON public.supertilt_columns;
DROP POLICY IF EXISTS "Supertilt members can insert columns" ON public.supertilt_columns;
DROP POLICY IF EXISTS "Supertilt members can update columns" ON public.supertilt_columns;
DROP POLICY IF EXISTS "Supertilt members can delete columns" ON public.supertilt_columns;
DROP POLICY IF EXISTS "Board members can view actions" ON public.supertilt_actions;
DROP POLICY IF EXISTS "Board members can insert actions" ON public.supertilt_actions;
DROP POLICY IF EXISTS "Board members can update actions" ON public.supertilt_actions;
DROP POLICY IF EXISTS "Board members can delete actions" ON public.supertilt_actions;
DROP POLICY IF EXISTS "Board members can view columns" ON public.supertilt_columns;
DROP POLICY IF EXISTS "Board members can insert columns" ON public.supertilt_columns;
DROP POLICY IF EXISTS "Board members can update columns" ON public.supertilt_columns;
DROP POLICY IF EXISTS "Board members can delete columns" ON public.supertilt_columns;

CREATE POLICY "Board members can view actions"
ON public.supertilt_actions FOR SELECT TO authenticated
USING (public.can_access_project_board(auth.uid(), board));

CREATE POLICY "Board members can insert actions"
ON public.supertilt_actions FOR INSERT TO authenticated
WITH CHECK (public.can_access_project_board(auth.uid(), board) AND user_id = auth.uid());

CREATE POLICY "Board members can update actions"
ON public.supertilt_actions FOR UPDATE TO authenticated
USING (public.can_access_project_board(auth.uid(), board))
WITH CHECK (public.can_access_project_board(auth.uid(), board));

CREATE POLICY "Board members can delete actions"
ON public.supertilt_actions FOR DELETE TO authenticated
USING (public.can_access_project_board(auth.uid(), board));

CREATE POLICY "Board members can view columns"
ON public.supertilt_columns FOR SELECT TO authenticated
USING (public.can_access_project_board(auth.uid(), board));

CREATE POLICY "Board members can insert columns"
ON public.supertilt_columns FOR INSERT TO authenticated
WITH CHECK (public.can_access_project_board(auth.uid(), board) AND user_id = auth.uid());

CREATE POLICY "Board members can update columns"
ON public.supertilt_columns FOR UPDATE TO authenticated
USING (public.can_access_project_board(auth.uid(), board))
WITH CHECK (public.can_access_project_board(auth.uid(), board));

CREATE POLICY "Board members can delete columns"
ON public.supertilt_columns FOR DELETE TO authenticated
USING (public.can_access_project_board(auth.uid(), board));

-- ── 3. Déplacement des cartes liées au site ────────────────────
-- Chaque carte garde sa colonne (par nom) et sa mission liée.
DO $$
DECLARE
  site_ids uuid[] := ARRAY[
    '3dec6d1e-ff4a-45b6-b9dc-cd5b0f4e8bde', -- Expérience mobile du site à améliorer
    '72028c32-489b-455b-9872-87fbd6dc08d3', -- Expérience mobile du tunnel d'achat à améliorer
    '71f57b41-6943-499a-9da2-4d6df259a233', -- Formulaire de contact à améliorer
    '8de87413-8d66-4f4f-8553-f95808583f9f', -- Corrigé panier sur tablette
    '5e18d5f5-e14e-4712-a6a4-bbb71079387a', -- Corrigé ste sur tablette
    'b179f536-48ae-486b-a2d7-289c7eb9af93', -- Bug sur la home page
    '27d367cc-60e1-4ed9-8450-0c6da26c25fd', -- en navigation privé, le panier ne s'affiche pas
    'ff1ec677-118a-45b7-a0e5-50ee27db64d4', -- Gros bug sur l'achat d'une formation (code de remise)
    'ff0ff648-9802-4713-b130-103aaaa65217', -- Facturation électronique et format Factur-X sur Woocommerce
    '0ad30c3b-7bb4-4f6d-b016-c9a378766068', -- Mise à jour boutique / Mondial relay
    'c52b105a-c25f-4f52-be0e-c41f0686a204', -- Suivi Stats SuperTilt (AI overview)
    'b20e7b90-a3ba-40f0-896f-afdb91f4a2b7'  -- Le crayon de Picto-Dico ne tourne plus
  ]::uuid[];
  owner_id uuid;
  col_name text;
BEGIN
  SELECT user_id INTO owner_id
  FROM public.supertilt_columns
  WHERE board = 'transverse'
  ORDER BY position, created_at
  LIMIT 1;

  IF owner_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.supertilt_columns WHERE board = 'site') THEN
    INSERT INTO public.supertilt_columns (user_id, name, position, board) VALUES
      (owner_id, 'À faire', 0, 'site'),
      (owner_id, 'En cours', 1, 'site'),
      (owner_id, 'Terminé', 2, 'site');
  END IF;

  FOR col_name IN
    SELECT DISTINCT c.name
    FROM public.supertilt_actions a
    JOIN public.supertilt_columns c ON c.id = a.column_id
    WHERE a.id = ANY(site_ids) AND a.board = 'transverse'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.supertilt_columns WHERE board = 'site' AND name = col_name
    ) THEN
      INSERT INTO public.supertilt_columns (user_id, name, position, board)
      SELECT owner_id, col_name, COALESCE(MAX(position), -1) + 1, 'site'
      FROM public.supertilt_columns
      WHERE board = 'site';
    END IF;
  END LOOP;

  UPDATE public.supertilt_actions a
  SET board = 'site',
      column_id = COALESCE(
        (
          SELECT s.id
          FROM public.supertilt_columns src
          JOIN public.supertilt_columns s ON s.name = src.name AND s.board = 'site'
          WHERE src.id = a.column_id
          ORDER BY s.position
          LIMIT 1
        ),
        (
          SELECT id FROM public.supertilt_columns
          WHERE board = 'site'
          ORDER BY position
          LIMIT 1
        )
      )
  WHERE a.id = ANY(site_ids) AND a.board = 'transverse';
END $$;
