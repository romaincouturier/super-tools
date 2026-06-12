-- ─────────────────────────────────────────────────────────────────────────────
-- Unified checklist template system
--
-- Two tables:
--   checklist_templates       — one template group (name, entity_type, global/personal)
--   checklist_template_items  — items in a template, with day_offset relative to
--                               entity start_date (e.g. -7 = J-7)
--
-- Global templates (is_global = true, user_id = null) replace the JSON stored
-- in app_settings.logistics_templates. The JSON key is kept for backward compat
-- during transition — the service layer will prefer the DB table once it exists.
--
-- RLS:
--   SELECT  — all authenticated staff can read global; owner reads personal
--   INSERT/UPDATE/DELETE — owner for personal; admin role for global
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.checklist_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  entity_type text        CHECK (entity_type IN ('mission', 'training')),  -- null = both
  is_global   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT global_has_no_owner CHECK (NOT (is_global AND user_id IS NOT NULL)),
  CONSTRAINT personal_has_owner  CHECK (is_global OR user_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.checklist_template_items (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id         uuid    NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  label               text    NOT NULL,
  day_offset          integer NOT NULL DEFAULT 0,
  notify_days_before  integer,
  legacy_field        text,
  position            integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklist_templates_user
  ON public.checklist_templates (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_checklist_template_items_template
  ON public.checklist_template_items (template_id, position);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public._set_checklist_template_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_checklist_template_updated_at ON public.checklist_templates;
CREATE TRIGGER trg_checklist_template_updated_at
BEFORE UPDATE ON public.checklist_templates
FOR EACH ROW EXECUTE FUNCTION public._set_checklist_template_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.checklist_templates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_template_items ENABLE ROW LEVEL SECURITY;

-- checklist_templates policies
DROP POLICY IF EXISTS "ct_select"  ON public.checklist_templates;
DROP POLICY IF EXISTS "ct_insert"  ON public.checklist_templates;
DROP POLICY IF EXISTS "ct_update"  ON public.checklist_templates;
DROP POLICY IF EXISTS "ct_delete"  ON public.checklist_templates;
DROP POLICY IF EXISTS "ct_service" ON public.checklist_templates;

CREATE POLICY "ct_select" ON public.checklist_templates
  FOR SELECT TO authenticated
  USING (is_global OR user_id = auth.uid());

CREATE POLICY "ct_insert" ON public.checklist_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    (NOT is_global AND user_id = auth.uid())
    OR (is_global AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
    ))
  );

CREATE POLICY "ct_update" ON public.checklist_templates
  FOR UPDATE TO authenticated
  USING (
    (NOT is_global AND user_id = auth.uid())
    OR (is_global AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
    ))
  )
  WITH CHECK (
    (NOT is_global AND user_id = auth.uid())
    OR (is_global AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
    ))
  );

CREATE POLICY "ct_delete" ON public.checklist_templates
  FOR DELETE TO authenticated
  USING (
    (NOT is_global AND user_id = auth.uid())
    OR (is_global AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
    ))
  );

CREATE POLICY "ct_service" ON public.checklist_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- checklist_template_items policies (access follows parent template)
DROP POLICY IF EXISTS "cti_select"  ON public.checklist_template_items;
DROP POLICY IF EXISTS "cti_insert"  ON public.checklist_template_items;
DROP POLICY IF EXISTS "cti_update"  ON public.checklist_template_items;
DROP POLICY IF EXISTS "cti_delete"  ON public.checklist_template_items;
DROP POLICY IF EXISTS "cti_service" ON public.checklist_template_items;

CREATE POLICY "cti_select" ON public.checklist_template_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.checklist_templates t
    WHERE t.id = template_id
      AND (t.is_global OR t.user_id = auth.uid())
  ));

CREATE POLICY "cti_insert" ON public.checklist_template_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.checklist_templates t
    WHERE t.id = template_id
      AND (
        (NOT t.is_global AND t.user_id = auth.uid())
        OR (t.is_global AND EXISTS (
          SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
        ))
      )
  ));

CREATE POLICY "cti_update" ON public.checklist_template_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.checklist_templates t
    WHERE t.id = template_id
      AND (
        (NOT t.is_global AND t.user_id = auth.uid())
        OR (t.is_global AND EXISTS (
          SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
        ))
      )
  ));

CREATE POLICY "cti_delete" ON public.checklist_template_items
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.checklist_templates t
    WHERE t.id = template_id
      AND (
        (NOT t.is_global AND t.user_id = auth.uid())
        OR (t.is_global AND EXISTS (
          SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
        ))
      )
  ));

CREATE POLICY "cti_service" ON public.checklist_template_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Migrate existing global templates from app_settings JSON
-- day_offset = 0 for all migrated items (no relative date was stored before)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_tmpl_id uuid;
BEGIN

  -- mission.presentiel
  INSERT INTO public.checklist_templates (name, entity_type, is_global)
  VALUES ('Mission présentiel', 'mission', true)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_tmpl_id;

  IF v_tmpl_id IS NOT NULL THEN
    INSERT INTO public.checklist_template_items (template_id, label, position, legacy_field, day_offset)
    VALUES
      (v_tmpl_id, 'Train réservé',  0, 'train_booked', 0),
      (v_tmpl_id, 'Hôtel réservé',  1, 'hotel_booked',  0);
  END IF;

  -- training.inter.presentiel
  INSERT INTO public.checklist_templates (name, entity_type, is_global)
  VALUES ('Formation inter présentiel', 'training', true)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_tmpl_id;

  IF v_tmpl_id IS NOT NULL THEN
    INSERT INTO public.checklist_template_items (template_id, label, position, legacy_field, day_offset)
    VALUES
      (v_tmpl_id, 'Salle réservée',                          0, 'room_rental_booked', 0),
      (v_tmpl_id, 'Mobilier confirmé (tables, chaises)',      1, NULL,                  0),
      (v_tmpl_id, 'Buffet d''accueil et pauses',             2, NULL,                  0),
      (v_tmpl_id, 'Matériel (paperboard, vidéoprojecteur)',   3, 'equipment_ready',     0),
      (v_tmpl_id, 'Restaurant midi',                          4, 'restaurant_booked',   0),
      (v_tmpl_id, 'Train réservé (formateur)',                5, 'train_booked',        0),
      (v_tmpl_id, 'Hôtel réservé (formateur)',                6, 'hotel_booked',        0),
      (v_tmpl_id, 'Email logistique envoyé au commanditaire', 7, NULL,                  0);
  END IF;

  -- training.intra.presentiel
  INSERT INTO public.checklist_templates (name, entity_type, is_global)
  VALUES ('Formation intra présentiel', 'training', true)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_tmpl_id;

  IF v_tmpl_id IS NOT NULL THEN
    INSERT INTO public.checklist_template_items (template_id, label, position, legacy_field, day_offset)
    VALUES
      (v_tmpl_id, 'Confirmation salle commanditaire',         0, NULL,                  0),
      (v_tmpl_id, 'Matériel sur place vérifié',               1, 'equipment_ready',     0),
      (v_tmpl_id, 'Train réservé (formateur)',                 2, 'train_booked',        0),
      (v_tmpl_id, 'Hôtel réservé (formateur)',                 3, 'hotel_booked',        0),
      (v_tmpl_id, 'Restaurant midi',                           4, 'restaurant_booked',   0),
      (v_tmpl_id, 'Email logistique envoyé au commanditaire',  5, NULL,                  0);
  END IF;

  -- training.classe_virtuelle
  INSERT INTO public.checklist_templates (name, entity_type, is_global)
  VALUES ('Formation classe virtuelle', 'training', true)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_tmpl_id;

  IF v_tmpl_id IS NOT NULL THEN
    INSERT INTO public.checklist_template_items (template_id, label, position, day_offset)
    VALUES
      (v_tmpl_id, 'Lien visio créé',               0, 0),
      (v_tmpl_id, 'Email d''invitation envoyé',    1, 0),
      (v_tmpl_id, 'Test technique réalisé',         2, 0);
  END IF;

  -- training.e_learning
  INSERT INTO public.checklist_templates (name, entity_type, is_global)
  VALUES ('Formation e-learning', 'training', true)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_tmpl_id;

  IF v_tmpl_id IS NOT NULL THEN
    INSERT INTO public.checklist_template_items (template_id, label, position, day_offset)
    VALUES
      (v_tmpl_id, 'Plateforme accessible aux participants', 0, 0),
      (v_tmpl_id, 'Comptes participants créés',             1, 0),
      (v_tmpl_id, 'Email d''accès envoyé',                 2, 0);
  END IF;

END $$;
