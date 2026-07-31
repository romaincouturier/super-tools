CREATE TABLE IF NOT EXISTS public.mission_deliverable_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  contact_id uuid,
  email text NOT NULL,
  item_keys text[] NOT NULL DEFAULT '{}',
  new_item_keys text[] NOT NULL DEFAULT '{}',
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mission_deliverable_sends_mission ON public.mission_deliverable_sends(mission_id);
CREATE INDEX IF NOT EXISTS idx_mission_deliverable_sends_email ON public.mission_deliverable_sends(lower(email));

GRANT SELECT ON public.mission_deliverable_sends TO authenticated;
GRANT ALL ON public.mission_deliverable_sends TO service_role;

ALTER TABLE public.mission_deliverable_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read deliverable sends" ON public.mission_deliverable_sends;
CREATE POLICY "Staff can read deliverable sends"
ON public.mission_deliverable_sends
FOR SELECT
TO authenticated
USING (public.is_staff_user());