-- ─────────────────────────────────────────────────────────────────────────────
-- Logistics checklist — replace the hardcoded *_booked booleans on missions
-- and trainings with an editable per-entity checklist.
--
-- This migration is the structural backbone:
--   1. Create `logistics_checklist_items`
--   2. Seed default templates into app_settings (one JSON object per
--      entity x format combo)
--   3. Backfill items for existing missions/trainings from their legacy
--      booleans (so nothing disappears in the UI)
--   4. Install a sync trigger: when an item flagged with `legacy_field`
--      is toggled, the matching legacy boolean is updated. This keeps
--      the existing alert system (`process-logistics-reminders`) working
--      verbatim during the transition. The trigger will be removed in
--      a later migration once alerts have been refactored to read from
--      this table directly.
--
-- ZERO-regression guarantee: legacy *_booked columns stay in place and
-- stay in sync with the new items.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.logistics_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('mission', 'training')),
  entity_id uuid NOT NULL,
  label text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  is_done boolean NOT NULL DEFAULT false,
  due_date date,                                  -- optional hard deadline
  notify_days_before integer,                     -- alert N days before due_date
  legacy_field text,                              -- e.g. 'train_booked' — sync hook
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  done_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_logistics_items_entity
  ON public.logistics_checklist_items (entity_type, entity_id, position);
CREATE INDEX IF NOT EXISTS idx_logistics_items_pending
  ON public.logistics_checklist_items (due_date)
  WHERE is_done = false AND due_date IS NOT NULL;

ALTER TABLE public.logistics_checklist_items ENABLE ROW LEVEL SECURITY;

-- Idempotent policy creation (DROP then CREATE) so the migration can be
-- re-applied safely after a partial failure.
DROP POLICY IF EXISTS "logistics_items_select"  ON public.logistics_checklist_items;
DROP POLICY IF EXISTS "logistics_items_insert"  ON public.logistics_checklist_items;
DROP POLICY IF EXISTS "logistics_items_update"  ON public.logistics_checklist_items;
DROP POLICY IF EXISTS "logistics_items_delete"  ON public.logistics_checklist_items;
DROP POLICY IF EXISTS "logistics_items_service" ON public.logistics_checklist_items;

CREATE POLICY "logistics_items_select" ON public.logistics_checklist_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "logistics_items_insert" ON public.logistics_checklist_items
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "logistics_items_update" ON public.logistics_checklist_items
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "logistics_items_delete" ON public.logistics_checklist_items
  FOR DELETE TO authenticated USING (true);
CREATE POLICY "logistics_items_service" ON public.logistics_checklist_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public._set_logistics_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.is_done IS DISTINCT FROM OLD.is_done THEN
    NEW.done_at = CASE WHEN NEW.is_done THEN now() ELSE NULL END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_logistics_updated_at ON public.logistics_checklist_items;
CREATE TRIGGER trg_logistics_updated_at
BEFORE UPDATE ON public.logistics_checklist_items
FOR EACH ROW EXECUTE FUNCTION public._set_logistics_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Sync trigger: when an item with `legacy_field` set is toggled, mirror
-- is_done into the corresponding *_booked column on missions/trainings.
-- Removable once the alert refactor is live.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._sync_legacy_logistics_field()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_field text;
  v_value boolean;
BEGIN
  v_field := NEW.legacy_field;
  v_value := NEW.is_done;
  IF v_field IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.entity_type = 'mission' THEN
    -- whitelist to avoid arbitrary column updates
    IF v_field IN ('train_booked', 'hotel_booked') THEN
      EXECUTE format('UPDATE public.missions SET %I = $1 WHERE id = $2', v_field)
        USING v_value, NEW.entity_id;
    END IF;
  ELSIF NEW.entity_type = 'training' THEN
    IF v_field IN ('train_booked', 'hotel_booked', 'restaurant_booked', 'room_rental_booked', 'equipment_ready') THEN
      EXECUTE format('UPDATE public.trainings SET %I = $1 WHERE id = $2', v_field)
        USING v_value, NEW.entity_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_logistics_sync_legacy ON public.logistics_checklist_items;
CREATE TRIGGER trg_logistics_sync_legacy
AFTER INSERT OR UPDATE OF is_done ON public.logistics_checklist_items
FOR EACH ROW WHEN (NEW.legacy_field IS NOT NULL)
EXECUTE FUNCTION public._sync_legacy_logistics_field();

-- ─────────────────────────────────────────────────────────────────────────────
-- Reverse sync: when a *_booked column changes on missions/trainings (via
-- the legacy UI), reflect it back on the matching checklist item so the
-- new checklist UI stays in sync with the old dropdowns. Removable in
-- the same later migration that drops the forward trigger.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._sync_logistics_from_legacy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_etype text := TG_ARGV[0];
BEGIN
  IF NEW.train_booked IS DISTINCT FROM OLD.train_booked THEN
    UPDATE public.logistics_checklist_items
       SET is_done = COALESCE(NEW.train_booked, false)
     WHERE entity_type = v_etype AND entity_id = NEW.id AND legacy_field = 'train_booked'
       AND is_done IS DISTINCT FROM COALESCE(NEW.train_booked, false);
  END IF;
  IF NEW.hotel_booked IS DISTINCT FROM OLD.hotel_booked THEN
    UPDATE public.logistics_checklist_items
       SET is_done = COALESCE(NEW.hotel_booked, false)
     WHERE entity_type = v_etype AND entity_id = NEW.id AND legacy_field = 'hotel_booked'
       AND is_done IS DISTINCT FROM COALESCE(NEW.hotel_booked, false);
  END IF;
  IF v_etype = 'training' THEN
    IF NEW.restaurant_booked IS DISTINCT FROM OLD.restaurant_booked THEN
      UPDATE public.logistics_checklist_items
         SET is_done = COALESCE(NEW.restaurant_booked, false)
       WHERE entity_type = v_etype AND entity_id = NEW.id AND legacy_field = 'restaurant_booked'
         AND is_done IS DISTINCT FROM COALESCE(NEW.restaurant_booked, false);
    END IF;
    IF NEW.room_rental_booked IS DISTINCT FROM OLD.room_rental_booked THEN
      UPDATE public.logistics_checklist_items
         SET is_done = COALESCE(NEW.room_rental_booked, false)
       WHERE entity_type = v_etype AND entity_id = NEW.id AND legacy_field = 'room_rental_booked'
         AND is_done IS DISTINCT FROM COALESCE(NEW.room_rental_booked, false);
    END IF;
    IF NEW.equipment_ready IS DISTINCT FROM OLD.equipment_ready THEN
      UPDATE public.logistics_checklist_items
         SET is_done = COALESCE(NEW.equipment_ready, false)
       WHERE entity_type = v_etype AND entity_id = NEW.id AND legacy_field = 'equipment_ready'
         AND is_done IS DISTINCT FROM COALESCE(NEW.equipment_ready, false);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_logistics_reverse_sync_mission ON public.missions;
CREATE TRIGGER trg_logistics_reverse_sync_mission
AFTER UPDATE OF train_booked, hotel_booked ON public.missions
FOR EACH ROW EXECUTE FUNCTION public._sync_logistics_from_legacy('mission');

DROP TRIGGER IF EXISTS trg_logistics_reverse_sync_training ON public.trainings;
CREATE TRIGGER trg_logistics_reverse_sync_training
AFTER UPDATE OF train_booked, hotel_booked, restaurant_booked, room_rental_booked, equipment_ready ON public.trainings
FOR EACH ROW EXECUTE FUNCTION public._sync_logistics_from_legacy('training');

-- ─────────────────────────────────────────────────────────────────────────────
-- Default templates stored in app_settings as JSON.
-- Code in src/services/logisticsTemplates.ts reads these to bootstrap
-- new entities, and falls back to compiled defaults if the row is empty.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.app_settings (setting_key, setting_value)
VALUES (
  'logistics_templates',
  '{
    "mission.presentiel": [
      {"label": "Train réservé", "legacy_field": "train_booked"},
      {"label": "Hôtel réservé", "legacy_field": "hotel_booked"}
    ],
    "mission.remote": [],
    "training.inter.presentiel": [
      {"label": "Salle réservée", "legacy_field": "room_rental_booked"},
      {"label": "Mobilier confirmé (tables, chaises)"},
      {"label": "Buffet d''accueil et pauses"},
      {"label": "Matériel (paperboard, vidéoprojecteur)", "legacy_field": "equipment_ready"},
      {"label": "Restaurant midi", "legacy_field": "restaurant_booked"},
      {"label": "Train réservé (formateur)", "legacy_field": "train_booked"},
      {"label": "Hôtel réservé (formateur)", "legacy_field": "hotel_booked"},
      {"label": "Email logistique envoyé au commanditaire"}
    ],
    "training.intra.presentiel": [
      {"label": "Confirmation salle commanditaire"},
      {"label": "Matériel sur place vérifié", "legacy_field": "equipment_ready"},
      {"label": "Train réservé (formateur)", "legacy_field": "train_booked"},
      {"label": "Hôtel réservé (formateur)", "legacy_field": "hotel_booked"},
      {"label": "Restaurant midi", "legacy_field": "restaurant_booked"},
      {"label": "Email logistique envoyé au commanditaire"}
    ],
    "training.classe_virtuelle": [
      {"label": "Lien visio créé"},
      {"label": "Email d''invitation envoyé"},
      {"label": "Test technique réalisé"}
    ],
    "training.e_learning": [
      {"label": "Plateforme accessible aux participants"},
      {"label": "Comptes participants créés"},
      {"label": "Email d''accès envoyé"}
    ]
  }'::text
)
ON CONFLICT (setting_key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill: turn existing *_booked booleans into checklist items so the
-- new UI shows something for every existing mission/training.
-- ─────────────────────────────────────────────────────────────────────────────

-- Missions
INSERT INTO public.logistics_checklist_items (entity_type, entity_id, label, position, is_done, legacy_field, done_at)
SELECT 'mission', m.id, 'Train réservé', 0, COALESCE(m.train_booked, false), 'train_booked',
       CASE WHEN m.train_booked THEN m.updated_at ELSE NULL END
FROM public.missions m
WHERE NOT EXISTS (
  SELECT 1 FROM public.logistics_checklist_items i
  WHERE i.entity_type = 'mission' AND i.entity_id = m.id AND i.legacy_field = 'train_booked'
);

INSERT INTO public.logistics_checklist_items (entity_type, entity_id, label, position, is_done, legacy_field, done_at)
SELECT 'mission', m.id, 'Hôtel réservé', 1, COALESCE(m.hotel_booked, false), 'hotel_booked',
       CASE WHEN m.hotel_booked THEN m.updated_at ELSE NULL END
FROM public.missions m
WHERE NOT EXISTS (
  SELECT 1 FROM public.logistics_checklist_items i
  WHERE i.entity_type = 'mission' AND i.entity_id = m.id AND i.legacy_field = 'hotel_booked'
);

-- Trainings
INSERT INTO public.logistics_checklist_items (entity_type, entity_id, label, position, is_done, legacy_field, done_at)
SELECT 'training', t.id, 'Train réservé', 0, COALESCE(t.train_booked, false), 'train_booked',
       CASE WHEN t.train_booked THEN t.updated_at ELSE NULL END
FROM public.trainings t
WHERE NOT EXISTS (
  SELECT 1 FROM public.logistics_checklist_items i
  WHERE i.entity_type = 'training' AND i.entity_id = t.id AND i.legacy_field = 'train_booked'
);

INSERT INTO public.logistics_checklist_items (entity_type, entity_id, label, position, is_done, legacy_field, done_at)
SELECT 'training', t.id, 'Hôtel réservé', 1, COALESCE(t.hotel_booked, false), 'hotel_booked',
       CASE WHEN t.hotel_booked THEN t.updated_at ELSE NULL END
FROM public.trainings t
WHERE NOT EXISTS (
  SELECT 1 FROM public.logistics_checklist_items i
  WHERE i.entity_type = 'training' AND i.entity_id = t.id AND i.legacy_field = 'hotel_booked'
);

INSERT INTO public.logistics_checklist_items (entity_type, entity_id, label, position, is_done, legacy_field, done_at)
SELECT 'training', t.id, 'Restaurant midi', 2, COALESCE(t.restaurant_booked, false), 'restaurant_booked',
       CASE WHEN t.restaurant_booked THEN t.updated_at ELSE NULL END
FROM public.trainings t
WHERE NOT EXISTS (
  SELECT 1 FROM public.logistics_checklist_items i
  WHERE i.entity_type = 'training' AND i.entity_id = t.id AND i.legacy_field = 'restaurant_booked'
);

INSERT INTO public.logistics_checklist_items (entity_type, entity_id, label, position, is_done, legacy_field, done_at)
SELECT 'training', t.id, 'Salle réservée', 3, COALESCE(t.room_rental_booked, false), 'room_rental_booked',
       CASE WHEN t.room_rental_booked THEN t.updated_at ELSE NULL END
FROM public.trainings t
WHERE NOT EXISTS (
  SELECT 1 FROM public.logistics_checklist_items i
  WHERE i.entity_type = 'training' AND i.entity_id = t.id AND i.legacy_field = 'room_rental_booked'
);

INSERT INTO public.logistics_checklist_items (entity_type, entity_id, label, position, is_done, legacy_field, done_at)
SELECT 'training', t.id, 'Matériel prêt', 4, COALESCE(t.equipment_ready, false), 'equipment_ready',
       CASE WHEN t.equipment_ready THEN t.updated_at ELSE NULL END
FROM public.trainings t
WHERE NOT EXISTS (
  SELECT 1 FROM public.logistics_checklist_items i
  WHERE i.entity_type = 'training' AND i.entity_id = t.id AND i.legacy_field = 'equipment_ready'
);
