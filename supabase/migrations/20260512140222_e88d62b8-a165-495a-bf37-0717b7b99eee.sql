-- Mission credits: allow tracking pre-paid credits per mission and link activities to them
CREATE TABLE public.mission_credits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX idx_mission_credits_mission_id ON public.mission_credits(mission_id);

ALTER TABLE public.mission_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view mission credits"
  ON public.mission_credits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert mission credits"
  ON public.mission_credits FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update mission credits"
  ON public.mission_credits FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete mission credits"
  ON public.mission_credits FOR DELETE TO authenticated USING (true);

ALTER TABLE public.mission_activities
  ADD COLUMN credit_id uuid REFERENCES public.mission_credits(id) ON DELETE SET NULL;

CREATE INDEX idx_mission_activities_credit_id ON public.mission_activities(credit_id);
