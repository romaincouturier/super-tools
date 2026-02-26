
-- Add 'reclamations' to app_module enum
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'reclamations';

-- Create reclamations table
CREATE TABLE public.reclamations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  date_reclamation date,
  client_name text,
  client_email text,
  canal text,
  problem_type text,
  description text,
  severity text,
  status text NOT NULL DEFAULT 'open',
  actions_decided text,
  response_sent text,
  response_date date,
  ai_analysis text,
  ai_response_draft text,
  qualiopi_summary text,
  training_id uuid REFERENCES public.trainings(id),
  mission_id uuid REFERENCES public.missions(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reclamations ENABLE ROW LEVEL SECURITY;

-- Authenticated users: full access (same pattern as improvements)
CREATE POLICY "Authenticated users can view reclamations"
  ON public.reclamations FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert reclamations"
  ON public.reclamations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update reclamations"
  ON public.reclamations FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete reclamations"
  ON public.reclamations FOR DELETE
  USING (auth.role() = 'authenticated');

-- Public (anon) access: read own reclamation by token
CREATE POLICY "Public can view reclamation by token"
  ON public.reclamations FOR SELECT
  USING (auth.role() = 'anon');

-- Public (anon) access: update own reclamation by token (submit the form)
CREATE POLICY "Public can update reclamation by token"
  ON public.reclamations FOR UPDATE
  USING (auth.role() = 'anon');

-- Trigger for updated_at
CREATE TRIGGER update_reclamations_updated_at
  BEFORE UPDATE ON public.reclamations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
