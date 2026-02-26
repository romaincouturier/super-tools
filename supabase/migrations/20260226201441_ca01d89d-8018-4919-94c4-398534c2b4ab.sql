
-- Table for trainer/pedagogical team evaluations (Indicator 30)
CREATE TABLE public.trainer_evaluations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  training_id uuid NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  trainer_name text NOT NULL,
  trainer_email text,
  token text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'non_envoye',
  email_sent_at timestamptz,
  date_submitted timestamptz,
  satisfaction_globale integer,
  points_forts text,
  axes_amelioration text,
  commentaires text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.trainer_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage trainer evaluations"
  ON public.trainer_evaluations FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Public can read own trainer evaluation by token"
  ON public.trainer_evaluations FOR SELECT
  USING (auth.role() = 'anon');

CREATE POLICY "Public can update trainer evaluation by token"
  ON public.trainer_evaluations FOR UPDATE
  USING (auth.role() = 'anon');

-- Auto-update updated_at
CREATE TRIGGER update_trainer_evaluations_updated_at
  BEFORE UPDATE ON public.trainer_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add funder appreciation field to trainings
ALTER TABLE public.trainings 
  ADD COLUMN IF NOT EXISTS funder_appreciation text,
  ADD COLUMN IF NOT EXISTS funder_appreciation_date date;
