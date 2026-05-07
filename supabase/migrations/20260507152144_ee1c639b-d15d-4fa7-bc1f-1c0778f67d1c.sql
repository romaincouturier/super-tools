-- Re-apply logistics checklist schema (table missing in DB)
CREATE TABLE IF NOT EXISTS public.logistics_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('mission', 'training')),
  entity_id uuid NOT NULL,
  label text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  is_done boolean NOT NULL DEFAULT false,
  due_date date,
  notify_days_before integer,
  legacy_field text,
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

INSERT INTO public.app_settings (setting_key, setting_value)
VALUES (
  'logistics_templates',
  '{"mission.presentiel":[{"label":"Train réservé","legacy_field":"train_booked"},{"label":"Hôtel réservé","legacy_field":"hotel_booked"}],"mission.remote":[],"training.inter.presentiel":[{"label":"Salle réservée","legacy_field":"room_rental_booked"},{"label":"Mobilier confirmé (tables, chaises)"},{"label":"Buffet d''accueil et pauses"},{"label":"Matériel (paperboard, vidéoprojecteur)","legacy_field":"equipment_ready"},{"label":"Restaurant midi","legacy_field":"restaurant_booked"},{"label":"Train réservé (formateur)","legacy_field":"train_booked"},{"label":"Hôtel réservé (formateur)","legacy_field":"hotel_booked"},{"label":"Email logistique envoyé au commanditaire"}],"training.intra.presentiel":[{"label":"Confirmation salle commanditaire"},{"label":"Matériel sur place vérifié","legacy_field":"equipment_ready"},{"label":"Train réservé (formateur)","legacy_field":"train_booked"},{"label":"Hôtel réservé (formateur)","legacy_field":"hotel_booked"},{"label":"Restaurant midi","legacy_field":"restaurant_booked"},{"label":"Email logistique envoyé au commanditaire"}],"training.classe_virtuelle":[{"label":"Lien visio créé"},{"label":"Email d''invitation envoyé"},{"label":"Test technique réalisé"}],"training.e_learning":[{"label":"Plateforme accessible aux participants"},{"label":"Comptes participants créés"},{"label":"Email d''accès envoyé"}]}'::text
)
ON CONFLICT (setting_key) DO NOTHING;