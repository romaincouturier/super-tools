-- 1. Allow 'event' as entity_type on the logistics checklist
ALTER TABLE public.logistics_checklist_items
  DROP CONSTRAINT IF EXISTS logistics_checklist_items_entity_type_check;
ALTER TABLE public.logistics_checklist_items
  ADD CONSTRAINT logistics_checklist_items_entity_type_check
  CHECK (entity_type IN ('mission', 'training', 'event'));

-- 2. Forward sync: checklist item -> events legacy booleans
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
  ELSIF NEW.entity_type = 'event' THEN
    IF v_field IN ('train_booked', 'hotel_booked', 'restaurant_booked', 'room_rental_booked') THEN
      EXECUTE format('UPDATE public.events SET %I = $1 WHERE id = $2', v_field)
        USING v_value, NEW.entity_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Reverse sync: events legacy booleans -> checklist items
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
  IF v_etype IN ('training', 'event') THEN
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
  END IF;
  IF v_etype = 'training' THEN
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

DROP TRIGGER IF EXISTS trg_logistics_reverse_sync_event ON public.events;
CREATE TRIGGER trg_logistics_reverse_sync_event
AFTER UPDATE OF train_booked, hotel_booked, restaurant_booked, room_rental_booked ON public.events
FOR EACH ROW EXECUTE FUNCTION public._sync_logistics_from_legacy('event');

-- 4. Default checklist templates for events
UPDATE public.app_settings
   SET setting_value = (
     (setting_value::jsonb
       || jsonb_build_object(
            'event.presentiel', jsonb_build_array(
              jsonb_build_object('label', 'Salle réservée', 'legacy_field', 'room_rental_booked'),
              jsonb_build_object('label', 'Train réservé', 'legacy_field', 'train_booked'),
              jsonb_build_object('label', 'Hôtel réservé', 'legacy_field', 'hotel_booked'),
              jsonb_build_object('label', 'Restaurant / traiteur', 'legacy_field', 'restaurant_booked'),
              jsonb_build_object('label', 'Matériel et signalétique prêts'),
              jsonb_build_object('label', 'Invitations envoyées'),
              jsonb_build_object('label', 'Liste des participants confirmée')
            ),
            'event.remote', jsonb_build_array(
              jsonb_build_object('label', 'Lien visio créé'),
              jsonb_build_object('label', 'Invitations envoyées'),
              jsonb_build_object('label', 'Test technique réalisé'),
              jsonb_build_object('label', 'Support de présentation prêt')
            )
          )
     )::text
   )
 WHERE setting_key = 'logistics_templates';
